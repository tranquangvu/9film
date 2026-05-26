import { NavLink } from 'react-router-dom'
import { Share2, Camera, Users, Play } from 'lucide-react'

const footerLinks = {
  Company: [
    { label: 'About Us', to: '/about' },
    { label: 'Careers', to: '/careers' },
    { label: 'Press', to: '/press' },
    { label: 'Blog', to: '/blog' },
  ],
  Support: [
    { label: 'Help Center', to: '/help' },
    { label: 'Contact Us', to: '/contact' },
    { label: 'Account', to: '/account' },
    { label: 'Accessibility', to: '/accessibility' },
  ],
  Legal: [
    { label: 'Privacy Policy', to: '/privacy' },
    { label: 'Terms of Use', to: '/terms' },
    { label: 'Cookie Policy', to: '/cookies' },
    { label: 'DMCA', to: '/dmca' },
  ],
}

const socials = [
  { icon: Share2, label: 'X (Twitter)', href: 'https://twitter.com' },
  { icon: Camera, label: 'Instagram', href: 'https://instagram.com' },
  { icon: Users, label: 'Facebook', href: 'https://facebook.com' },
  { icon: Play, label: 'YouTube', href: 'https://youtube.com' },
]

export default function Footer() {
  return (
    <footer className="border-t border-white/5" style={{ background: '#0a0a0a' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14">
        {/* Top section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <NavLink to="/" className="flex items-center gap-1.5 mb-3">
              <span className="text-xl">🎬</span>
              <span className="text-xl font-bold tracking-tight text-gradient">NiceFilm</span>
            </NavLink>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              Premium streaming for cinema lovers. Discover the world's greatest films, series, and stories.
            </p>

            {/* Socials */}
            <div className="flex items-center gap-2 mt-5">
              {socials.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-orange-500 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <NavLink
                      to={link.to}
                      className="text-sm text-zinc-500 hover:text-orange-500 transition-colors"
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Follow Us (social repeat for mobile readability) */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              Follow Us
            </h4>
            <ul className="flex flex-col gap-2.5">
              {socials.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-500 hover:text-orange-500 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} NiceFilm. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <NavLink to="/privacy" className="text-xs text-zinc-600 hover:text-orange-500 transition-colors">Privacy</NavLink>
            <NavLink to="/terms" className="text-xs text-zinc-600 hover:text-orange-500 transition-colors">Terms</NavLink>
            <NavLink to="/cookies" className="text-xs text-zinc-600 hover:text-orange-500 transition-colors">Cookies</NavLink>
          </div>
        </div>
      </div>
    </footer>
  )
}
