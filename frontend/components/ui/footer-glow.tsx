'use client';

import {
  Github,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Linkedin,
} from 'lucide-react';
import Link from 'next/link';

const data = {
  twitterLink: 'https://twitter.com',
  githubLink: 'https://github.com',
  linkedinLink: 'https://linkedin.com',
  company: {
    name: 'Meeting Assistant',
    description:
      'Context-aware RAG workspace for meeting insights and document chat. Powered by Groq Llama 3.1 and FAISS.',
  },
  product: {
    features: '/features',
    pricing: '/pricing',
    integrations: '/integrations',
    updates: '/updates',
  },
  company_links: {
    about: '/about',
    careers: '/careers',
    blog: '/blog',
    contact: '/contact',
  },
  resources: {
    docs: '/docs',
    community: '/community',
    support: '/support',
    security: '/security',
  },
  contact: {
    email: 'hello@meetingassistant.com',
    phone: '+1 (555) 123-4567',
    address: 'San Francisco, CA, USA',
  },
};

const socialLinks = [
  { icon: Twitter, label: 'Twitter', href: data.twitterLink },
  { icon: Github, label: 'GitHub', href: data.githubLink },
  { icon: Linkedin, label: 'LinkedIn', href: data.linkedinLink },
];

const productLinks = [
  { text: 'Features', href: data.product.features },
  { text: 'Pricing', href: data.product.pricing },
  { text: 'Integrations', href: data.product.integrations },
  { text: 'Updates', href: data.product.updates },
];

const companyLinks = [
  { text: 'About', href: data.company_links.about },
  { text: 'Careers', href: data.company_links.careers },
  { text: 'Blog', href: data.company_links.blog },
  { text: 'Contact', href: data.company_links.contact },
];

const resourceLinks = [
  { text: 'Docs', href: data.resources.docs },
  { text: 'Community', href: data.resources.community },
  { text: 'Support', href: data.resources.support },
  { text: 'Security', href: data.resources.security },
];

const contactInfo = [
  { icon: Mail, text: data.contact.email },
  { icon: Phone, text: data.contact.phone },
  { icon: MapPin, text: data.contact.address, isAddress: true },
];

export default function FooterGlow() {
  return (
    <footer className="relative bg-black w-full">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute top-0 left-1/2 z-0 h-full w-full -translate-x-1/2 select-none">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-[#6B2FD8]/20 blur-3xl"></div>
        <div className="absolute right-1/4 -bottom-24 h-80 w-80 rounded-full bg-[#6B2FD8]/20 blur-3xl"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - Company Info */}
          <div>
            <div className="flex items-center justify-center gap-3 sm:justify-start">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6B2FD8] to-[#8B5CF6] text-white shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span className="text-2xl font-semibold text-white">
                {data.company.name}
              </span>
            </div>

            <p className="text-white/60 mt-6 max-w-md text-center leading-relaxed sm:max-w-xs sm:text-left text-sm">
              {data.company.description}
            </p>

            <ul className="mt-8 flex justify-center gap-4 sm:justify-start">
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6B2FD8]/20 text-[#6B2FD8] hover:bg-[#6B2FD8] hover:text-white transition"
                  >
                    <span className="sr-only">{label}</span>
                    <Icon className="size-5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Columns - Navigation */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:col-span-2">
            {/* Product */}
            <div className="text-center sm:text-left">
              <p className="font-semibold text-[#6B2FD8] uppercase text-sm tracking-wider">Product</p>
              <ul className="mt-6 space-y-3 text-sm">
                {productLinks.map(({ text, href }) => (
                  <li key={text}>
                    <a
                      className="text-white/60 hover:text-[#6B2FD8] transition"
                      href={href}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="text-center sm:text-left">
              <p className="font-semibold text-[#6B2FD8] uppercase text-sm tracking-wider">Company</p>
              <ul className="mt-6 space-y-3 text-sm">
                {companyLinks.map(({ text, href }) => (
                  <li key={text}>
                    <a
                      className="text-white/60 hover:text-[#6B2FD8] transition"
                      href={href}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div className="text-center sm:text-left">
              <p className="font-semibold text-[#6B2FD8] uppercase text-sm tracking-wider">Resources</p>
              <ul className="mt-6 space-y-3 text-sm">
                {resourceLinks.map(({ text, href }) => (
                  <li key={text}>
                    <a
                      className="text-white/60 hover:text-[#6B2FD8] transition"
                      href={href}
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6"></div>

        {/* Copyright */}
        <div className="text-center sm:flex sm:justify-between sm:text-left pb-4">
          <p className="text-white/50 text-xs">
            <span className="block sm:inline">All rights reserved.</span>
          </p>
          <p className="text-white/50 mt-4 text-xs sm:order-first sm:mt-0">
            &copy; 2025 {data.company.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
