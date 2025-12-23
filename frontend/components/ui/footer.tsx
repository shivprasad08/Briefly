import React, { useState } from "react";
import { FaGithub, FaLinkedin, FaTwitter } from "react-icons/fa";
import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

interface Footer7Props {
  logo?: {
    url: string;
    alt: string;
    title: string;
  };
  description?: string;
  socialLinks?: Array<{
    icon: React.ReactElement;
    href: string;
    label: string;
  }>;
  copyright?: string;
}

const defaultSocialLinks = [
  { icon: <FaTwitter className="size-5" />, href: "https://x.com/Shivprasad_08", label: "Twitter" },
  { icon: <FaGithub className="size-5" />, href: "https://github.com/shivprasad08", label: "GitHub" },
  { icon: <FaLinkedin className="size-5" />, href: "https://www.linkedin.com/in/shivprasad-mahind08", label: "LinkedIn" },
];

const contactInfo = [
  { icon: Mail, text: "shivprasad.mahind@gmail.com" },
  { icon: MapPin, text: "Pune, Maharashtra", isAddress: true },
];

export const Footer7 = ({
  logo = {
    url: "/",
    alt: "Briefly",
    title: "Briefly",
  },
  description = "Hi! I'm Shivprasad Mahind, a Third Year Computer Engineering student at PCCOE. Passionate about exploring the intersection of AI and web technologies.",
  socialLinks = defaultSocialLinks,
  copyright = "© 2025 Briefly. All rights reserved.",
}: Footer7Props) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setSubmitMessage('');

    // Simulate API call
    setTimeout(() => {
      setSubmitMessage('Thanks for reaching out! We\'ll be in touch soon.');
      setEmail('');
      setMessage('');
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <footer className="bg-black w-full border-t border-neutral-800">
      <div className="mx-auto max-w-screen-xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16 sm:pb-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div>
            <div className="flex justify-center gap-2 sm:justify-start items-center">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6B2FD8] to-[#8B5CF6] text-white shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  className="h-4 w-4 sm:h-5 sm:w-5"
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
              <span className="text-xl sm:text-2xl font-semibold text-white">
                {logo.title}
              </span>
            </div>

            <p className="text-white/60 mt-6 max-w-md text-center leading-relaxed sm:max-w-xs sm:text-left">
              {description}
            </p>

            <ul className="mt-8 flex justify-center gap-6 sm:justify-start md:gap-8">
              {socialLinks.map((social, idx) => (
                <li key={idx}>
                  <Link
                    href={social.href}
                    aria-label={social.label}
                    className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#6B2FD8]/10 text-[#6B2FD8] hover:bg-[#6B2FD8] hover:text-white transition"
                  >
                    {social.icon}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:col-span-2">
            <div className="text-center sm:text-left">
              <p className="text-lg font-medium text-white">Contact Us</p>
              <ul className="mt-8 space-y-4 text-sm">
                {contactInfo.map(({ icon: Icon, text, isAddress }) => (
                  <li key={text}>
                    <a
                      className="flex items-center justify-center gap-1.5 sm:justify-start"
                      href="#"
                    >
                      <Icon className="text-[#6B2FD8] size-5 shrink-0" />
                      {isAddress ? (
                        <address className="text-white/70 -mt-0.5 flex-1 not-italic">
                          {text}
                        </address>
                      ) : (
                        <span className="text-white/70 flex-1">
                          {text}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-center sm:text-left">
              <p className="text-lg font-medium text-white mb-4">Connect with me</p>
              <p className="text-sm text-white/70 mb-6">
                Interested in updates? Drop your email and message below.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6B2FD8] focus:border-transparent transition"
                  required
                />
                <textarea
                  placeholder="Your message or comments (optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#6B2FD8] focus:border-transparent transition resize-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full px-4 py-3 rounded-lg bg-[#6B2FD8] hover:bg-[#5A25B8] text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Stay Connected'}
                </button>
                {submitMessage && (
                  <p className="text-sm text-[#6B2FD8] text-center">{submitMessage}</p>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-4">
          <div className="text-center">
            <p className="text-sm text-white/70">
              {copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
