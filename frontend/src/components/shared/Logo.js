import React from 'react';

const LOGO_URL = 'https://customer-assets.emergentagent.com/job_fa7f3ba8-8537-4e4d-b681-0c7370599acf/artifacts/97toq6ph_5994E62C-2857-42AA-AD0D-FDE7E1D9452D%202023-05-13%2002_57_33.png';

export default function Logo({ size = 'md', className = '' }) {
  const sizes = { sm: 32, md: 48, lg: 80, xl: 120 };
  const px = sizes[size] || 48;
  return (
    <img
      src={LOGO_URL}
      alt="Ciltarasa Logo"
      width={px}
      height={px}
      className={`object-contain ${className}`}
      style={{ imageRendering: 'crisp-edges' }}
    />
  );
}

export function LogoWithText({ size = 'md', className = '' }) {
  const imgSizes = { sm: 28, md: 40, lg: 64 };
  const px = imgSizes[size] || 40;
  const textSizes = { sm: 'text-base', md: 'text-xl', lg: 'text-3xl' };
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={LOGO_URL} alt="Ciltarasa" width={px} height={px} className="object-contain" />
      <div>
        <div className={`font-heading font-bold text-[#78350F] ${textSizes[size]}`}>Ciltarasa</div>
        {size !== 'sm' && <div className="text-xs font-body text-[#92400E] leading-tight">Ngemil & Ngebekal Praktis!</div>}
      </div>
    </div>
  );
}
