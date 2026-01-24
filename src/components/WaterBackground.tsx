import { Droplet } from 'lucide-react';

export function WaterBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Gradient overlay */}
      <div className="absolute inset-0 gradient-surface opacity-80" />
      
      {/* Floating droplets */}
      <div className="absolute top-20 left-10 text-water-200 animate-float opacity-40">
        <Droplet size={40} />
      </div>
      <div className="absolute top-40 right-20 text-teal-200 animate-float opacity-30" style={{ animationDelay: '1s' }}>
        <Droplet size={60} />
      </div>
      <div className="absolute bottom-32 left-1/4 text-water-100 animate-float opacity-25" style={{ animationDelay: '2s' }}>
        <Droplet size={50} />
      </div>
      <div className="absolute top-1/3 right-1/3 text-teal-100 animate-float opacity-20" style={{ animationDelay: '3s' }}>
        <Droplet size={35} />
      </div>
      
      {/* Circular gradient blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-water-100 rounded-full blur-3xl opacity-40" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-teal-100 rounded-full blur-3xl opacity-30" />
    </div>
  );
}
