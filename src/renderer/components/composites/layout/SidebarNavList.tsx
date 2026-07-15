import { useNavigate, useLocation } from 'react-router-dom';
import { QuickLink } from '@renderer/components/composites';
import { PRIMARY_DESTINATIONS } from '@renderer/navigation';

export function SidebarNavList() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="space-y-0.5 px-2 py-2">
      {PRIMARY_DESTINATIONS.map((destination) => (
        <QuickLink
          key={destination.id}
          icon={destination.icon}
          label={destination.label}
          onClick={() => navigate(destination.path)}
          isActive={destination.isActive(location.pathname)}
          className="h-8 rounded-lg px-2 text-sm"
        />
      ))}
    </div>
  );
}
