#!/usr/bin/env python3
"""
Extract Crunchyroll's OAuth credentials (client_id / client_secret) and app
version from an official *Crunchyroll for Android TV* APK, build the matching
`basic_auth_token` + `User-Agent`, and patch them into
`modules/module.api-urls.ts`.

Why this exists
---------------
Crunchyroll periodically rotates the client_id/secret and changes the
User-Agent format. When that happens the downloader stops authenticating and
the values in `module.api-urls.ts` have to be refreshed. This script automates
the reverse-engineering step that was previously done by hand with jadx.

How it works
------------
The credentials live in the class `com.crunchyroll.api.util.Constants` as
`static final String` fields (PROD_CLIENT_ID, PROD_CLIENT_SECRET,
FIRETV_PROD_CLIENT_ID, ...). This script reads the APK with the stdlib
`zipfile` module, parses the DEX string pool + static-field initializers
directly (no external tools), and resolves those field names to their literal
string values. The app version is read from the binary AndroidManifest.xml.

Usage
-----
    python3 scripts/update-crunchyroll-creds.py <path-to-base.apk>
    python3 scripts/update-crunchyroll-creds.py crunchyroll_apk/base.apk --dry-run
    python3 scripts/update-crunchyroll-creds.py base.apk --device firetv

Only the Python standard library is required (Python 3.8+).
"""

from __future__ import annotations

import argparse
import base64
import os
import re
import struct
import sys
import zipfile

# ---------------------------------------------------------------------------
# Config: what we look for and what we write
# ---------------------------------------------------------------------------

CONSTANTS_CLASS = "Lcom/crunchyroll/api/util/Constants;"
EXPECTED_PACKAGE = "com.crunchyroll.crunchyroid"

# Fields to pull out of the Constants class, per device profile.
CRED_FIELDS = {
    "androidtv": ("PROD_CLIENT_ID", "PROD_CLIENT_SECRET"),
    "firetv": ("FIRETV_PROD_CLIENT_ID", "FIRETV_PROD_CLIENT_SECRET"),
}

# Device profile used to render the User-Agent. The device fields (model /
# manufacturer / brand) are cosmetic for the token API; these mimic the real
# hardware the app runs on. The DeviceType token + credentials must stay in
# sync (androidtv -> ANDROIDTV/NVIDIA SHIELD, firetv -> FIRETV/Amazon).
DEVICE_PROFILE = {
    "androidtv": {
        "type": "ANDROIDTV",
        "model": "SHIELD Android TV",
        "manufacturer": "NVIDIA",
        "brand": "NVIDIA",
    },
    "firetv": {
        "type": "FIRETV",
        "model": "AFTMM",
        "manufacturer": "Amazon",
        "brand": "Amazon",
    },
}

# Plausible Android OS release reported in the UA (SHIELD/Fire TV run 9-12).
DEFAULT_ANDROID_VERSION = "12"

# Validation patterns for the extracted secrets (fail loudly on garbage).
RE_CLIENT_ID = re.compile(r"^[A-Za-z0-9_-]{18,24}$")
RE_CLIENT_SECRET = re.compile(r"^[A-Za-z0-9_-]{28,40}$")

DEFAULT_TS_FILE = "modules/module.api-urls.ts"


# ---------------------------------------------------------------------------
# Small binary readers
# ---------------------------------------------------------------------------

def _u16(data: bytes, off: int) -> int:
    return struct.unpack_from("<H", data, off)[0]


def _u32(data: bytes, off: int) -> int:
    return struct.unpack_from("<I", data, off)[0]


def _uleb128(data: bytes, off: int):
    result = 0
    shift = 0
    while True:
        b = data[off]
        off += 1
        result |= (b & 0x7F) << shift
        if (b & 0x80) == 0:
            break
        shift += 7
    return result, off


# ---------------------------------------------------------------------------
# DEX parsing: resolve static-final-String fields of a given class
# ---------------------------------------------------------------------------

class Dex:
    """Minimal DEX reader: just enough to read a class' static string fields."""

    def __init__(self, data: bytes):
        if data[:3] != b"dex":
            raise ValueError("not a DEX file")
        self.data = data
        self.string_ids_off = _u32(data, 0x3C)
        self.string_ids_size = _u32(data, 0x38)
        self.type_ids_off = _u32(data, 0x44)
        self.field_ids_off = _u32(data, 0x54)
        self.class_defs_size = _u32(data, 0x60)
        self.class_defs_off = _u32(data, 0x64)

    def string(self, idx: int) -> str:
        doff = _u32(self.data, self.string_ids_off + idx * 4)
        _, p = _uleb128(self.data, doff)  # utf16 length prefix (unused)
        end = self.data.index(b"\x00", p)
        # MUTF-8; plain utf-8 decode is correct for ASCII field names/values.
        return self.data[p:end].decode("utf-8", "replace")

    def type_descriptor(self, type_idx: int) -> str:
        str_idx = _u32(self.data, self.type_ids_off + type_idx * 4)
        return self.string(str_idx)

    def field_name(self, field_idx: int) -> str:
        # field_id_item: class_idx(u16) type_idx(u16) name_idx(u32)
        name_idx = _u32(self.data, self.field_ids_off + field_idx * 8 + 4)
        return self.string(name_idx)

    def _read_encoded_value(self, off: int):
        """Return (value_or_None, new_off). Only strings are materialised;
        every other type is skipped correctly to keep the array aligned."""
        data = self.data
        header = data[off]
        off += 1
        vtype = header & 0x1F
        varg = (header >> 5) & 0x7

        if vtype == 0x17:  # VALUE_STRING
            n = varg + 1
            v = int.from_bytes(data[off:off + n], "little")
            off += n
            return self.string(v), off
        if vtype in (0x00, 0x02, 0x03, 0x04, 0x06, 0x10, 0x11,
                     0x15, 0x16, 0x18, 0x19, 0x1A, 0x1B):
            # byte/short/char/int/long/float/double + typed index refs
            off += varg + 1
            return None, off
        if vtype == 0x1C:  # VALUE_ARRAY
            size, off = _uleb128(data, off)
            for _ in range(size):
                _, off = self._read_encoded_value(off)
            return None, off
        if vtype == 0x1D:  # VALUE_ANNOTATION
            _, off = _uleb128(data, off)          # type_idx
            size, off = _uleb128(data, off)       # size
            for _ in range(size):
                _, off = _uleb128(data, off)       # name_idx
                _, off = self._read_encoded_value(off)
            return None, off
        if vtype in (0x1E, 0x1F):  # VALUE_NULL / VALUE_BOOLEAN (no payload)
            return None, off
        raise ValueError(f"unknown encoded_value type 0x{vtype:02x}")

    def static_string_fields(self, class_descriptor: str):
        """Map {field_name: str_value} for all static-final-String fields of
        the given class, or None if the class is not present in this DEX."""
        data = self.data
        for i in range(self.class_defs_size):
            cd = self.class_defs_off + i * 32
            class_idx = _u32(data, cd)
            if self.type_descriptor(class_idx) != class_descriptor:
                continue
            class_data_off = _u32(data, cd + 24)
            static_values_off = _u32(data, cd + 28)
            if class_data_off == 0:
                return {}
            # class_data_item: 4 uleb sizes, then static_fields list
            off = class_data_off
            sf_size, off = _uleb128(data, off)
            _, off = _uleb128(data, off)  # instance_fields_size
            _, off = _uleb128(data, off)  # direct_methods_size
            _, off = _uleb128(data, off)  # virtual_methods_size
            names = []
            cur = 0
            for _ in range(sf_size):
                diff, off = _uleb128(data, off)
                _, off = _uleb128(data, off)  # access_flags
                cur += diff  # field_idx is cumulative
                names.append(self.field_name(cur))
            out = {}
            if static_values_off == 0:
                return out
            off = static_values_off
            arr_size, off = _uleb128(data, off)
            for k in range(arr_size):
                val, off = self._read_encoded_value(off)
                if k < len(names) and isinstance(val, str):
                    out[names[k]] = val
            return out
        return None


def extract_constants(apk: zipfile.ZipFile):
    """Search every classesN.dex for the Constants class and return its
    static string fields."""
    dex_names = sorted(
        n for n in apk.namelist()
        if re.fullmatch(r"classes\d*\.dex", n)
    )
    for name in dex_names:
        try:
            dex = Dex(apk.read(name))
        except ValueError:
            continue
        fields = dex.static_string_fields(CONSTANTS_CLASS)
        if fields:
            return fields, name
    return None, None


# ---------------------------------------------------------------------------
# Binary AndroidManifest.xml (AXML) parsing: versionName + package
# ---------------------------------------------------------------------------

# Framework attribute resource IDs, used when the attribute name string is
# stripped to "" (common with aapt2 output).
_RESID_NAMES = {0x0101021B: "versionCode", 0x0101021C: "versionName"}


def _axml_string_pool(data: bytes, off: int):
    # ResStringPool_header
    string_count = _u32(data, off + 8)
    flags = _u32(data, off + 16)
    strings_start = _u32(data, off + 20)
    is_utf8 = bool(flags & 0x100)
    pool = []
    offsets_base = off + 28
    data_base = off + strings_start
    for i in range(string_count):
        so = data_base + _u32(data, offsets_base + i * 4)
        if is_utf8:
            # two length fields (utf16 len, utf8 len), each 1-2 bytes
            n = data[so]
            so += 2 if (n & 0x80) else 1
            m = data[so]
            so += 2 if (m & 0x80) else 1
            length = ((m & 0x7F) << 8 | data[so - 1]) if (m & 0x80) else m
            pool.append(data[so:so + length].decode("utf-8", "replace"))
        else:
            n = _u16(data, so)
            so += 2
            if n & 0x8000:  # long string, second u16
                n = ((n & 0x7FFF) << 16) | _u16(data, so)
                so += 2
            pool.append(data[so:so + n * 2].decode("utf-16-le", "replace"))
    return pool


def parse_axml(data: bytes):
    """Return dict with 'package' and 'versionName' from a binary AXML manifest."""
    if _u32(data, 0) & 0xFFFF != 0x0003:
        raise ValueError("not a binary AndroidManifest.xml")

    pool = []
    resmap = []
    off = 8  # skip file header (type u16, headerSize u16, size u32)
    size = _u32(data, 4)

    # Walk top-level chunks
    result = {"package": None, "versionName": None, "versionCode": None}
    while off + 8 <= size:
        ctype = _u16(data, off)
        chunk_size = _u32(data, off + 4)
        if chunk_size <= 0:
            break
        if ctype == 0x0001:  # RES_STRING_POOL
            pool = _axml_string_pool(data, off)
        elif ctype == 0x0180:  # RES_XML_RESOURCE_MAP
            count = (chunk_size - 8) // 4
            resmap = [_u32(data, off + 8 + i * 4) for i in range(count)]
        elif ctype == 0x0102:  # RES_XML_START_ELEMENT
            _parse_start_element(data, off, pool, resmap, result)
            if result["versionName"] is not None:
                # manifest is the first element; we have what we need
                break
        off += chunk_size
    return result


def _attr_name(pool, resmap, name_idx: int) -> str:
    s = pool[name_idx] if 0 <= name_idx < len(pool) else ""
    if s:
        return s
    if 0 <= name_idx < len(resmap):
        return _RESID_NAMES.get(resmap[name_idx], "")
    return ""


def _parse_start_element(data, off, pool, resmap, result):
    # ResChunk_header(8) + ResXMLTree_node(8: lineNumber, comment)
    # + ResXMLTree_attrExt
    base = off + 8 + 8
    name_idx = _u32(data, base + 4)
    tag = pool[name_idx] if 0 <= name_idx < len(pool) else ""
    if tag != "manifest":
        return
    attr_start = _u16(data, base + 8)
    attr_count = _u16(data, base + 12)
    attrs_base = base + attr_start
    for i in range(attr_count):
        a = attrs_base + i * 20  # ResXMLTree_attribute is 20 bytes
        a_name_idx = _u32(data, a + 4)
        raw_value_idx = _u32(data, a + 8)
        # Res_value: size(u16) res0(u8) dataType(u8) data(u32)
        data_type = data[a + 15]
        value_data = _u32(data, a + 16)
        name = _attr_name(pool, resmap, a_name_idx)
        if name not in ("package", "versionName", "versionCode"):
            continue
        if raw_value_idx != 0xFFFFFFFF and raw_value_idx < len(pool):
            value = pool[raw_value_idx]
        elif data_type == 0x03 and value_data < len(pool):  # TYPE_STRING
            value = pool[value_data]
        else:
            value = str(value_data)
        result[name] = value


# ---------------------------------------------------------------------------
# Output construction + file patching
# ---------------------------------------------------------------------------

def build_basic_auth_token(client_id: str, client_secret: str) -> str:
    raw = f"{client_id}:{client_secret}".encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def build_user_agent(version: str, device: str, android_version: str) -> str:
    p = DEVICE_PROFILE[device]
    return (f"Crunchyroll/{version} Android/{android_version}; "
            f"{p['type']}; {p['model']}; {p['manufacturer']}; {p['brand']}")


def patch_ts_file(ts_path: str, basic_token: str, user_agent: str,
                  dry_run: bool) -> bool:
    with open(ts_path, "r", encoding="utf-8") as fh:
        src = fh.read()

    def replace_field(text, field, value):
        pattern = re.compile(rf"({re.escape(field)}:\s*')[^']*(')")
        new_text, count = pattern.subn(
            lambda m: m.group(1) + value + m.group(2), text, count=1)
        if count != 1:
            raise RuntimeError(
                f"expected exactly one '{field}' assignment in {ts_path}, "
                f"found {count}")
        return new_text

    patched = replace_field(src, "basic_auth_token", basic_token)
    patched = replace_field(patched, "crunchyDefUserAgent", user_agent)

    if patched == src:
        print("  -> values already up to date, nothing to change.")
        return False
    if dry_run:
        print("  -> [dry-run] would update the two fields above.")
        return False
    with open(ts_path, "w", encoding="utf-8") as fh:
        fh.write(patched)
    print(f"  -> patched {ts_path}")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract Crunchyroll Android-TV OAuth credentials from an "
                    "APK and patch module.api-urls.ts.")
    parser.add_argument("apk", help="path to the Crunchyroll base.apk "
                                     "(or a folder containing base.apk)")
    parser.add_argument("--device", choices=("androidtv", "firetv"),
                        default="androidtv",
                        help="credential/UA profile (default: androidtv)")
    parser.add_argument("--android-version", default=DEFAULT_ANDROID_VERSION,
                        help=f"Android OS version in the UA "
                             f"(default: {DEFAULT_ANDROID_VERSION})")
    parser.add_argument("--ts-file", default=None,
                        help=f"target TS file (default: {DEFAULT_TS_FILE} "
                             f"relative to the repo root)")
    parser.add_argument("--dry-run", action="store_true",
                        help="print what would change without writing")
    args = parser.parse_args(argv)

    apk_path = args.apk
    if os.path.isdir(apk_path):
        apk_path = os.path.join(apk_path, "base.apk")
    if not os.path.isfile(apk_path):
        print(f"error: APK not found: {apk_path}", file=sys.stderr)
        return 2

    # Resolve the TS target relative to the repo root (parent of scripts/).
    if args.ts_file:
        ts_file = args.ts_file
    else:
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ts_file = os.path.join(repo_root, DEFAULT_TS_FILE)
    if not os.path.isfile(ts_file):
        print(f"error: TS file not found: {ts_file}", file=sys.stderr)
        return 2

    print(f"Reading APK: {apk_path}")
    with zipfile.ZipFile(apk_path) as apk:
        # Sanity check: is this actually the Crunchyroll app?
        try:
            manifest = parse_axml(apk.read("AndroidManifest.xml"))
        except (KeyError, ValueError, struct.error, IndexError) as exc:
            print(f"error: could not read AndroidManifest.xml ({exc})",
                  file=sys.stderr)
            return 1

        package = manifest.get("package")
        version = manifest.get("versionName")
        print(f"  package:     {package}")
        print(f"  versionName: {version}")
        if package != EXPECTED_PACKAGE:
            print(f"error: unexpected package '{package}', expected "
                  f"'{EXPECTED_PACKAGE}'. Is this the Crunchyroll Android-TV "
                  f"APK? (aptoide.com often serves the Aptoide store client)",
                  file=sys.stderr)
            return 1
        if not version:
            print("error: could not determine versionName", file=sys.stderr)
            return 1

        fields, dex_name = extract_constants(apk)
        if not fields:
            print("error: could not locate the Constants class in any DEX. "
                  "Crunchyroll may have obfuscated it; fall back to jadx.",
                  file=sys.stderr)
            return 1
        print(f"  constants:   found in {dex_name}")

    id_field, secret_field = CRED_FIELDS[args.device]
    client_id = fields.get(id_field)
    client_secret = fields.get(secret_field)
    if not client_id or not client_secret:
        print(f"error: {id_field}/{secret_field} not found in Constants "
              f"(available: {sorted(fields)})", file=sys.stderr)
        return 1
    if not RE_CLIENT_ID.match(client_id) or not RE_CLIENT_SECRET.match(client_secret):
        print(f"error: extracted values fail validation "
              f"(id='{client_id}', secret='{client_secret}')", file=sys.stderr)
        return 1

    basic_token = build_basic_auth_token(client_id, client_secret)
    user_agent = build_user_agent(version, args.device, args.android_version)

    print()
    print(f"Device profile:    {args.device}")
    print(f"  client_id:       {client_id}")
    print(f"  client_secret:   {client_secret}")
    print(f"  basic_auth_token:{basic_token}")
    print(f"  User-Agent:      {user_agent}")
    print()
    print(f"Patching {ts_file}")
    changed = patch_ts_file(ts_file, basic_token, user_agent, args.dry_run)

    if changed:
        print("\nDone. Review the diff and run the TypeScript build/tests.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
