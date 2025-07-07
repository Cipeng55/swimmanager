import React from 'react';

export const PodiumIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2v2" />
    <path d="M8 6h8" />
    <path d="M12 18v-5" />
    <path d="M4 18h16" />
    <path d="M8 13h8V6H8v7Z" />
    <path d="M6 18v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
  </svg>
);
