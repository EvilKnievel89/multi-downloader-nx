import React from 'react';
import useStore from '../hooks/useStore';

type Services = 'crunchy' | 'hidive' | 'adn';

export const serviceContext = React.createContext<Services | undefined>(undefined);

/**
 * Previously this component gated the whole app behind a service-selection
 * screen. The modern shell always renders; the SideBar now owns service
 * selection (Weiche A). We keep the context so any future consumer can read the
 * active service, but it may legitimately be `undefined` when nothing is picked.
 */
const ServiceProvider: FCWithChildren = ({ children }) => {
	const [{ service }] = useStore();

	return <serviceContext.Provider value={service}>{children}</serviceContext.Provider>;
};

export default ServiceProvider;
