import { useNavigate, useLocation } from 'react-router-dom';
import { QuickLink } from '@renderer/components/composites';
import { PRIMARY_DESTINATIONS } from '@renderer/navigation';

export function SidebarNavList() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="p-2 border-b border-border space-y-0.5">
      {PRIMARY_DESTINATIONS.map((destination) => (
        <QuickLink
          key={destination.id}
          icon={destination.icon}
          label={destination.label}
          onClick={() => navigate(destination.path)}
          isActive={destination.isActive(location.pathname)}
        />
      ))}
    </div>
  );
}
