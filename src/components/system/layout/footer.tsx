import { NavLink } from 'react-router-dom';

const links = [
  { label: 'About', to: '/about' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Disclaimer', to: '/disclaimer' },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0a]">
      <div className="px-6 md:px-12 py-8 flex items-center justify-between">
        <NavLink to="/" className="text-base font-bold tracking-tight text-gradient">
          9film
        </NavLink>

        <nav className="flex items-center gap-5">
          {links.map(link => (
            <NavLink
              key={link.label}
              to={link.to}
              className="text-xs text-zinc-500 hover:text-orange-500 transition-colors"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
