import React, { useState, useEffect, useRef } from 'react';

export interface LandingPageProps {
  onStartGuest: () => void;
  onLogin: () => void;
  onOpenByok: () => void;
  user?: { id?: string; name?: string; email?: string; image?: string } | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  onLogout?: () => void;
  onNavigateWorkbench?: () => void;
}

const LANDING_CSS = `
  .brag-landing {
    --bg-app: #0C0D10;
    --bg-canvas: #111317;
    --bg-sidebar: #14161B;
    --bg-card: #1A1D24;
    --bg-elevated: #20242C;
    --bg-code: #171A20;
    --border: #2B303A;
    --border-soft: #20242C;

    --text-primary: #F5F7FA;
    --text-secondary: #A5ADBB;
    --text-muted: #6F7684;

    --violet-1: #6F5CFF;
    --violet-2: #8A74FF;
    --violet-3: #A18DFF;

    --c-planning: #7C5CFF;
    --c-repository: #3B80FB;
    --c-documentation: #34D399;
    --c-runtime: #F8BF74;
    --c-evidence: #F35171;
    --c-completed: #10B981;

    --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --font-mono: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
    --ease: cubic-bezier(.22,.9,.3,1);

    background: var(--bg-app);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    position: relative;
    min-height: 100vh;
  }

  .brag-landing * { box-sizing: border-box; }
  .brag-landing a { color: inherit; text-decoration: none; }
  .brag-landing .wrap { max-width: 1180px; margin: 0 auto; padding: 0 32px; }
  .brag-landing section { position: relative; z-index: 1; }

  /* Atmosphere Background */
  .brag-landing .atmosphere {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background: linear-gradient(180deg, var(--bg-app) 0%, var(--bg-canvas) 100%);
  }
  .brag-landing .mesh-blob {
    position: absolute; border-radius: 50%; filter: blur(90px); opacity: .16; will-change: transform;
  }
  .brag-landing .mesh-1 { width: 520px; height: 520px; top: -160px; left: 8%; background: var(--violet-1); animation: meshDrift1 26s ease-in-out infinite; }
  .brag-landing .mesh-2 { width: 460px; height: 460px; top: 120px; right: 4%; background: var(--c-repository); animation: meshDrift2 32s ease-in-out infinite; opacity: .10; }
  .brag-landing .mesh-3 { width: 380px; height: 380px; bottom: -120px; left: 38%; background: var(--c-documentation); animation: meshDrift3 30s ease-in-out infinite; opacity: .07; }
  @keyframes meshDrift1 { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(40px,60px) scale(1.12); } }
  @keyframes meshDrift2 { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(-50px,30px) scale(1.08); } }
  @keyframes meshDrift3 { 0%,100%{ transform: translate(0,0) scale(1); } 50%{ transform: translate(30px,-40px) scale(1.1); } }

  .brag-landing .bg-grid {
    position: absolute; inset: 0; z-index: 0;
    background-image:
      linear-gradient(to right, rgba(245,247,250,0.035) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(245,247,250,0.035) 1px, transparent 1px);
    background-size: 44px 44px;
    -webkit-mask-image: radial-gradient(60% 60% at 50% 0%, #000 0%, transparent 75%);
    mask-image: radial-gradient(60% 60% at 50% 0%, #000 0%, transparent 75%);
  }

  /* Header */
  .brag-landing header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(12,13,16,0.72);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border-soft);
    transition: border-color .3s ease, background .3s ease;
  }
  .brag-landing nav { display: flex; align-items: center; justify-content: space-between; padding: 18px 32px; max-width: 1180px; margin: 0 auto; }
  .brag-landing .brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; letter-spacing: -0.01em; cursor: pointer; }
  .brag-landing .brand-mark {
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, var(--violet-1), var(--violet-3));
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; color: #fff;
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset;
  }
  .brag-landing .nav-links { display: flex; align-items: center; gap: 36px; font-size: 13.5px; color: var(--text-secondary); }
  .brag-landing .nav-links a { transition: color .18s ease; cursor: pointer; }
  .brag-landing .nav-links a:hover { color: var(--text-primary); }
  .brag-landing .nav-right { display: flex; align-items: center; gap: 18px; }

  /* Buttons */
  .brag-landing .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    font-family: var(--font-body); font-size: 13.5px; font-weight: 600;
    padding: 10px 18px; border-radius: 9px; cursor: pointer;
    border: 1px solid transparent;
    transition: transform .2s var(--ease), box-shadow .25s ease, background .2s ease, border-color .2s ease;
    white-space: nowrap; will-change: transform;
  }
  .brag-landing .btn:active { transform: translateY(1px) scale(.98) !important; }
  .brag-landing .btn-primary {
    background: linear-gradient(135deg, var(--violet-1), var(--violet-2));
    color: #fff;
    box-shadow: 0 1px 0 rgba(255,255,255,0.14) inset, 0 8px 24px -10px rgba(111,92,255,0.55);
  }
  .brag-landing .btn-primary:hover { box-shadow: 0 1px 0 rgba(255,255,255,0.18) inset, 0 14px 32px -8px rgba(111,92,255,0.75); }
  .brag-landing .btn-secondary { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--border); }
  .brag-landing .btn-secondary:hover { background: #262b34; border-color: #3a4150; }
  .brag-landing .btn-sm { padding: 8px 14px; font-size: 12.5px; border-radius: 8px; }

  /* Hero Section */
  .brag-landing .hero { padding: 112px 32px 80px; position: relative; }
  .brag-landing .hero-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center;
    max-width: 1180px; margin: 0 auto;
  }
  .brag-landing .hero-copy { position: relative; z-index: 2; }
  .brag-landing .hero-fade {
    opacity: 0; transform: translateY(18px);
    transition: opacity .8s var(--d,0s) var(--ease), transform .8s var(--d,0s) var(--ease);
  }
  .brag-landing.loaded .hero-fade { opacity: 1; transform: translateY(0); }

  .brag-landing .kicker {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12.5px; font-weight: 500; color: var(--text-muted);
    background: var(--bg-card); border: 1px solid var(--border);
    padding: 6px 14px 6px 10px; border-radius: 100px; margin-bottom: 26px;
  }
  .brag-landing .kicker-dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--c-completed);
    box-shadow: 0 0 0 3px rgba(16,185,129,0.15); animation: softPulse 2.2s ease-in-out infinite;
  }
  @keyframes softPulse { 0%,100%{ opacity: 1; transform: scale(1); } 50%{ opacity: .55; transform: scale(1.25); } }

  .brag-landing .hero h1 {
    font-size: clamp(32px, 4.4vw, 50px);
    font-weight: 600; letter-spacing: -0.02em; line-height: 1.14;
    color: var(--text-primary);
  }
  .brag-landing .hero h1 .accent {
    background: linear-gradient(135deg, var(--violet-2), var(--violet-3));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .brag-landing .hero p.lead {
    margin-top: 20px; max-width: 460px; font-size: 16px; color: var(--text-secondary); line-height: 1.65;
  }
  .brag-landing .hero-actions { display: flex; align-items: center; gap: 12px; margin-top: 34px; flex-wrap: wrap; }
  .brag-landing .hero-actions .btn { padding: 12px 22px; font-size: 14px; }

  /* Hero Visual Stage */
  .brag-landing .hero-visual {
    position: relative; height: 460px;
    display: flex; align-items: center; justify-content: center;
  }
  .brag-landing .cursor-glow {
    position: absolute; width: 420px; height: 420px; border-radius: 50%;
    background: radial-gradient(circle, rgba(138,116,255,0.22), transparent 68%);
    left: 0; top: 0; pointer-events: none; z-index: 0;
    transform: translate3d(var(--gx, 50%), var(--gy, 50%), 0) translate(-50%,-50%);
    transition: transform .25s ease-out, opacity .3s ease;
    opacity: 0;
  }
  .brag-landing .hero-visual:hover .cursor-glow { opacity: 1; }

  .brag-landing .graph-svg { position: relative; z-index: 1; width: 100%; max-width: 560px; height: auto; overflow: visible; }
  .brag-landing .graph-line {
    stroke-width: 1.4; fill: none; stroke-dasharray: 5 5; opacity: .55;
    animation: flowDash 1.6s linear infinite;
  }
  @keyframes flowDash { to { stroke-dashoffset: -40; } }

  .brag-landing .graph-node { transition: transform .25s var(--ease); }
  .brag-landing .graph-node circle.core { fill: var(--bg-card); stroke-width: 1.6; }
  .brag-landing .graph-node text { font-family: var(--font-body); font-size: 11px; fill: var(--text-muted); }
  .brag-landing .center-node .core { fill: var(--bg-elevated); stroke: var(--violet-2); stroke-width: 1.8; }
  .brag-landing .center-node text { font-size: 12px; font-weight: 600; fill: var(--text-primary); }

  .brag-landing .ping {
    fill: none; stroke: var(--violet-2); stroke-width: 1.2; opacity: 0;
    transform-origin: 300px 260px; animation: ping 2.6s ease-out infinite;
  }
  .brag-landing .ping.p2 { animation-delay: 1.3s; }
  @keyframes ping { 0%{ opacity: .5; transform: scale(1); } 100%{ opacity: 0; transform: scale(1.9); } }

  /* Floating Cards */
  .brag-landing .floating-card {
    position: absolute; background: var(--bg-card); border: 1px solid var(--border-soft);
    border-radius: 12px; padding: 14px 15px; z-index: 2;
    box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
    animation: bob 5s ease-in-out infinite;
  }
  @keyframes bob { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-8px); } }

  .brag-landing .fc-timeline { top: 2%; right: 0; width: 172px; animation-delay: .2s; }
  .brag-landing .fc-timeline h5 { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 10px; }
  .brag-landing .fc-timeline ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .brag-landing .fc-timeline li { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); transition: color .3s ease; }
  .brag-landing .fc-timeline li .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); flex-shrink: 0; transition: background .3s ease, box-shadow .3s ease; }
  .brag-landing .fc-timeline li.active { color: var(--text-primary); }
  .brag-landing .fc-timeline li.active .dot { background: var(--c-completed); box-shadow: 0 0 0 3px rgba(16,185,129,0.16); }

  .brag-landing .fc-report { bottom: 6%; right: 6%; width: 196px; animation-delay: 1.4s; }
  .brag-landing .fc-report .rt { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .brag-landing .fc-report .rt span { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); }
  .brag-landing .fc-report .badge { font-size: 10.5px; font-weight: 600; color: var(--c-completed); background: rgba(16,185,129,0.12); padding: 2px 7px; border-radius: 100px; }
  .brag-landing .fc-report p { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }

  .brag-landing .fc-code {
    bottom: 0%; left: 2%; font-family: var(--font-mono); font-size: 11.5px; color: var(--c-runtime);
    padding: 9px 13px; animation-delay: .8s;
  }
  .brag-landing .fc-code span { display: block; transition: opacity .5s ease; }

  /* Floating Particles */
  .brag-landing .particle {
    position: absolute; width: 4px; height: 4px; border-radius: 50%; background: var(--violet-3); opacity: 0;
    animation: floatUp linear infinite;
  }
  @keyframes floatUp { 0%{ opacity: 0; transform: translateY(0); } 15%{ opacity: .6; } 85%{ opacity: .5; } 100%{ opacity: 0; transform: translateY(-70px); } }

  /* Stats Strip */
  .brag-landing .stats { padding: 20px 32px 92px; }
  .brag-landing .stats-row {
    display: grid; grid-template-columns: repeat(3,1fr); gap: 1px;
    background: var(--border-soft); border: 1px solid var(--border-soft); border-radius: 16px; overflow: hidden;
  }
  .brag-landing .stat { background: var(--bg-canvas); padding: 30px 24px; text-align: center; }
  .brag-landing .stat .num { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .brag-landing .stat .num .accent { color: var(--violet-3); }
  .brag-landing .stat .lbl { margin-top: 6px; font-size: 13px; color: var(--text-muted); }

  /* Section Shell & Reveals */
  .brag-landing .section-head { text-align: center; max-width: 560px; margin: 0 auto 56px; }
  .brag-landing .eyebrow { display: block; font-size: 12px; font-weight: 600; letter-spacing: .06em; color: var(--violet-3); text-transform: uppercase; margin-bottom: 14px; }
  .brag-landing .section-head h2 { font-size: 28px; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); }
  .brag-landing .section-head p { margin-top: 14px; font-size: 15px; color: var(--text-secondary); line-height: 1.65; }

  .brag-landing .reveal { opacity: 0; transform: translateY(22px) scale(.985); transition: opacity .7s var(--ease), transform .7s var(--ease); }
  .brag-landing .reveal.in { opacity: 1; transform: translateY(0) scale(1); }

  /* Features Grid */
  .brag-landing .features { padding: 0 32px 110px; }
  .brag-landing .feature-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; perspective: 900px; }
  .brag-landing .feature-card {
    background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 14px; padding: 26px 22px;
    transition: border-color .25s ease, background .25s ease, transform .25s var(--ease), box-shadow .3s ease;
    transform-style: preserve-3d; will-change: transform;
  }
  .brag-landing .feature-card:hover { border-color: var(--border); background: var(--bg-elevated); box-shadow: 0 24px 50px -28px rgba(0,0,0,0.55); }
  .brag-landing .feature-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; font-size: 17px; transition: transform .3s var(--ease); }
  .brag-landing .feature-card:hover .feature-icon { transform: scale(1.08) translateZ(20px); }
  .brag-landing .icon-a { background: rgba(124,92,255,0.12); color: var(--c-planning); }
  .brag-landing .icon-b { background: rgba(59,128,251,0.12); color: var(--c-repository); }
  .brag-landing .icon-c { background: rgba(52,211,153,0.12); color: var(--c-documentation); }
  .brag-landing .icon-d { background: rgba(248,191,116,0.12); color: var(--c-runtime); }
  .brag-landing .feature-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary); }
  .brag-landing .feature-card p { font-size: 13.5px; color: var(--text-muted); line-height: 1.55; }

  /* Stack Marquee */
  .brag-landing .stack { padding: 0 0 110px; }
  .brag-landing .stack .section-head { padding: 0 32px; margin-bottom: 40px; }
  .brag-landing .marquee {
    overflow: hidden; position: relative;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  .brag-landing .marquee-track { display: flex; gap: 14px; width: max-content; animation: marquee 26s linear infinite; }
  .brag-landing .marquee:hover .marquee-track { animation-play-state: paused; }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  .brag-landing .chip {
    display: flex; align-items: center; gap: 8px; white-space: nowrap;
    background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 10px;
    padding: 11px 18px; font-size: 13px; color: var(--text-secondary);
    transition: border-color .25s ease, color .25s ease, background .25s ease;
  }
  .brag-landing .chip:hover { border-color: var(--violet-2); color: var(--text-primary); background: var(--bg-elevated); }
  .brag-landing .chip .cdot { width: 6px; height: 6px; border-radius: 50%; }

  /* Architecture & Pipeline */
  .brag-landing .architecture {
    padding: 110px 32px; background: var(--bg-canvas); border-top: 1px solid var(--border-soft); border-bottom: 1px solid var(--border-soft);
  }
  .brag-landing .pipeline { position: relative; display: grid; grid-template-columns: repeat(6, 1fr); gap: 0; margin-top: 20px; }
  .brag-landing .pipeline::before {
    content: ""; position: absolute; top: 19px; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--border) 6%, var(--border) 94%, transparent);
  }
  .brag-landing .pipeline::after {
    content: ""; position: absolute; top: 19px; left: 0; width: 100%; height: 2px;
    background: linear-gradient(90deg, var(--c-planning), var(--c-repository), var(--c-documentation), var(--c-runtime), var(--c-evidence), var(--c-completed));
    background-size: 200% 100%;
    opacity: .5;
    animation: flowLine 6s linear infinite;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  }
  @keyframes flowLine { 0%{ background-position: 200% 0; } 100%{ background-position: -40% 0; } }

  .brag-landing .pstep { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 10px; cursor: default; }
  .brag-landing .pdot {
    width: 11px; height: 11px; border-radius: 50%; background: var(--bg-canvas);
    border: 2px solid var(--dot-color, var(--violet-2)); margin-bottom: 18px; z-index: 1;
    box-shadow: 0 0 0 6px var(--bg-canvas);
    transition: transform .25s var(--ease), box-shadow .25s ease;
  }
  .brag-landing .pstep:hover .pdot { transform: scale(1.35); box-shadow: 0 0 0 6px var(--bg-canvas), 0 0 14px 2px var(--dot-color, var(--violet-2)); }
  .brag-landing .pstep h4 { font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; transition: color .2s ease; }
  .brag-landing .pstep span { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
  .brag-landing .pstep:hover h4 { color: var(--dot-color, var(--violet-3)); }

  .brag-landing .arch-panel {
    margin-top: 64px; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 16px; padding: 6px;
    display: grid; grid-template-columns: 1.1fr 1fr; gap: 6px; align-items: stretch;
  }
  .brag-landing .arch-copy { padding: 34px 30px; }
  .brag-landing .arch-copy h3 { font-size: 19px; font-weight: 600; margin-bottom: 12px; letter-spacing: -0.01em; }
  .brag-landing .arch-copy p { font-size: 14px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 20px; }
  .brag-landing .arch-list { display: flex; flex-direction: column; gap: 12px; }
  .brag-landing .arch-list li { list-style: none; display: flex; align-items: flex-start; gap: 10px; font-size: 13.5px; color: var(--text-secondary); }
  .brag-landing .arch-list li::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: var(--violet-3); margin-top: 7px; flex-shrink: 0; }
  .brag-landing .arch-code { background: var(--bg-code); border-radius: 12px; padding: 22px 20px; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.85; overflow: auto; }
  .brag-landing .cl-key { color: var(--c-repository); }
  .brag-landing .cl-str { color: var(--c-documentation); }
  .brag-landing .cl-com { color: var(--text-muted); }
  .brag-landing .cl-num { color: var(--c-runtime); }
  .brag-landing .cl-punc { color: var(--text-muted); }
  .brag-landing .cursor { display: inline-block; width: 7px; height: 14px; background: var(--violet-2); vertical-align: middle; margin-left: 2px; animation: blink 1.1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }

  /* CTA */
  .brag-landing .cta { padding: 120px 32px; text-align: center; }
  .brag-landing .cta h2 { font-size: 32px; font-weight: 600; letter-spacing: -0.01em; max-width: 520px; margin: 0 auto; }
  .brag-landing .cta p { margin: 16px auto 0; max-width: 440px; color: var(--text-secondary); font-size: 15px; }
  .brag-landing .cta-actions { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 32px; flex-wrap: wrap; }

  /* Footer */
  .brag-landing footer { border-top: 1px solid var(--border-soft); padding: 56px 32px 40px; }
  .brag-landing .footer-top { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 40px; padding-bottom: 40px; margin-bottom: 32px; border-bottom: 1px solid var(--border-soft); }
  .brag-landing .footer-brand { max-width: 280px; }
  .brag-landing .footer-brand .brand { margin-bottom: 14px; }
  .brag-landing .footer-brand p { font-size: 13px; color: var(--text-muted); line-height: 1.6; }
  .brag-landing .footer-cols { display: flex; gap: 64px; }
  .brag-landing .footer-col h5 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); margin-bottom: 16px; }
  .brag-landing .footer-col a { display: block; font-size: 13.5px; color: var(--text-secondary); margin-bottom: 11px; transition: color .18s ease; }
  .brag-landing .footer-col a:hover { color: var(--text-primary); }
  .brag-landing .footer-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
  .brag-landing .mecha { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-muted); }
  .brag-landing .mecha-avatar { width: 24px; height: 24px; border-radius: 7px; background: var(--bg-elevated); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .brag-landing .mecha b { color: var(--text-secondary); font-weight: 600; }
  .brag-landing .footer-signature { font-size: 12.5px; color: var(--text-muted); }

  /* Responsive Queries */
  @media (max-width: 980px) {
    .brag-landing .hero-grid { grid-template-columns: 1fr; }
    .brag-landing .hero-copy { text-align: center; }
    .brag-landing .hero-copy .hero-actions { justify-content: center; }
    .brag-landing .hero-copy p.lead { margin-left: auto; margin-right: auto; }
    .brag-landing .hero-visual { height: 380px; margin-top: 20px; }
  }
  @media (max-width: 860px) {
    .brag-landing .nav-links { display: none; }
    .brag-landing .feature-grid { grid-template-columns: repeat(2, 1fr); }
    .brag-landing .pipeline { grid-template-columns: repeat(3, 1fr); row-gap: 36px; }
    .brag-landing .pipeline::before, .brag-landing .pipeline::after { display: none; }
    .brag-landing .arch-panel { grid-template-columns: 1fr; }
    .brag-landing .stats-row { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .brag-landing .fc-timeline, .brag-landing .fc-report, .brag-landing .fc-code { display: none; }
  }
  @media (max-width: 520px) {
    .brag-landing .feature-grid { grid-template-columns: 1fr; }
    .brag-landing .pipeline { grid-template-columns: repeat(2, 1fr); }
    .brag-landing .hero { padding: 88px 20px 60px; }
    .brag-landing .footer-top { flex-direction: column; }
  }

  @media (prefers-reduced-motion: reduce) {
    .brag-landing * { animation: none !important; transition: none !important; }
    .brag-landing .hero-fade { opacity: 1 !important; transform: none !important; }
    .brag-landing .reveal { opacity: 1 !important; transform: none !important; }
    .brag-landing .marquee-track { flex-wrap: wrap; width: auto; }
    .brag-landing .marquee { overflow: visible; -webkit-mask-image: none; mask-image: none; }
  }
`;

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartGuest,
  onLogin,
  onOpenByok,
  user,
  isAuthenticated = false,
  isLoading = false,
  onLogout,
  onNavigateWorkbench
}) => {
  const [activeTimelineIdx, setActiveTimelineIdx] = useState(0);
  const [codeIdx, setCodeIdx] = useState(0);
  const [codeVisible, setCodeVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Counter state
  const [countA, setCountA] = useState('0');
  const [countB, setCountB] = useState('0');
  const [countC, setCountC] = useState('0');

  const heroVisualRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const statsSectionRef = useRef<HTMLElement>(null);
  const countersStartedRef = useRef(false);

  const timelineSteps = ['Planning', 'Repository', 'Documentation', 'Evidence'];
  const codeFragments = ['payment_service.ts:142', 'REDIS_POOL_SIZE=50', 'err_redis_max_clients'];

  // Magnetic button handler
  const handleMagneticMove = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    e.currentTarget.style.transition = 'none';
    e.currentTarget.style.transform = `translate(${x * 0.22}px, ${y * 0.32}px)`;
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    e.currentTarget.style.transition = 'transform .35s cubic-bezier(.22,.9,.3,1)';
    e.currentTarget.style.transform = 'translate(0, 0)';
  };

  // 3D Tilt Card handler
  const handleCardTiltMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    e.currentTarget.style.transition = 'none';
    e.currentTarget.style.transform = `translateY(-4px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
  };

  const handleCardTiltLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transition = 'transform .4s cubic-bezier(.22,.9,.3,1)';
    e.currentTarget.style.transform = 'translateY(0) rotateX(0) rotateY(0)';
  };

  useEffect(() => {
    // Trigger entrance fade
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Cursor glow tracker
  useEffect(() => {
    const stage = heroVisualRef.current;
    const glow = glowRef.current;
    if (!stage || !glow) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      glow.style.setProperty('--gx', `${x}%`);
      glow.style.setProperty('--gy', `${y}%`);
    };

    stage.addEventListener('mousemove', handleMouseMove);
    return () => stage.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Floating timeline cycling (every 1.9s)
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setActiveTimelineIdx((prev) => (prev + 1) % timelineSteps.length);
    }, 1900);
    return () => clearInterval(interval);
  }, [timelineSteps.length]);

  // Floating code crossfade cycling (every 2.6s)
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setCodeVisible(false);
      setTimeout(() => {
        setCodeIdx((prev) => (prev + 1) % codeFragments.length);
        setCodeVisible(true);
      }, 260);
    }, 2600);
    return () => clearInterval(interval);
  }, [codeFragments.length]);

  // Scroll reveal observer & Statistics counter
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    document.querySelectorAll('.brag-landing .reveal').forEach((el) => {
      revealObserver.observe(el);
    });

    // Counter animation
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !countersStartedRef.current) {
            countersStartedRef.current = true;
            statsObserver.unobserve(entry.target);

            if (prefersReduced) {
              setCountA('3.2');
              setCountB('94');
              setCountC('12,400');
              return;
            }

            const duration = 1400;
            const start = performance.now();

            const tick = (now: number) => {
              const p = Math.min((now - start) / duration, 1);
              const progress = easeOutExpo(p);

              setCountA((3.2 * progress).toFixed(1));
              setCountB(Math.round(94 * progress).toString());
              setCountC(Math.round(12400 * progress).toLocaleString());

              if (p < 1) {
                requestAnimationFrame(tick);
              }
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (statsSectionRef.current) {
      statsObserver.observe(statsSectionRef.current);
    }

    return () => {
      revealObserver.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  const marqueeChips = [
    { name: 'GitHub', color: '#3B80FB' },
    { name: 'GitLab', color: '#3B80FB' },
    { name: 'Datadog', color: '#F8BF74' },
    { name: 'Sentry', color: '#F35171' },
    { name: 'PostgreSQL', color: '#34D399' },
    { name: 'Redis', color: '#F35171' },
    { name: 'Context7', color: '#34D399' },
    { name: 'Slack', color: '#7C5CFF' },
    { name: 'PagerDuty', color: '#F8BF74' },
    { name: 'CloudWatch', color: '#3B80FB' }
  ];

  return (
    <div className={`brag-landing ${isLoaded ? 'loaded' : ''}`}>
      <style>{LANDING_CSS}</style>

      {/* Atmospheric Background & Mesh Blobs */}
      <div className="atmosphere">
        <div className="mesh-blob mesh-1" />
        <div className="mesh-blob mesh-2" />
        <div className="mesh-blob mesh-3" />
        <div className="bg-grid" />
      </div>

      {/* Navigation Header */}
      <header>
        <nav>
          <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="brand-mark">B</div>
            <span>BRAG</span>
          </div>
          <div className="nav-links">
            <a href="#mission">Mission</a>
            <a href="#features">Instruments</a>
            <a href="#architecture">Intelligence</a>
            <a onClick={onOpenByok}>BYOK Hub</a>
          </div>
          <div className="nav-right">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-16 h-8 bg-[#20242C] rounded-lg animate-pulse" />
                <div className="w-24 h-8 bg-[#20242C] rounded-lg animate-pulse" />
              </div>
            ) : isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[#1A1D24] border border-[#2B303A] px-3 py-1.5 rounded-lg text-xs font-mono text-[#F5F7FA]">
                  <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="truncate max-w-[140px]">{user.name || user.email}</span>
                </div>
                <button
                  onClick={onNavigateWorkbench || onStartGuest}
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="btn btn-primary btn-sm magnetic"
                >
                  <span>Open Console</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    onMouseMove={handleMagneticMove}
                    onMouseLeave={handleMagneticLeave}
                    className="btn btn-secondary btn-sm magnetic"
                    title="Sign Out"
                  >
                    Log Out
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onLogin}
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="btn btn-secondary btn-sm magnetic"
                >
                  Log In
                </button>
                <button
                  onClick={onStartGuest}
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="btn btn-primary btn-sm magnetic"
                >
                  <span>Start Investigation →</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero" id="mission">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="kicker hero-fade" style={{ '--d': '0s' } as React.CSSProperties}>
              <span className="kicker-dot" />
              Now investigating production incidents
            </span>
            <h1 className="hero-fade" style={{ '--d': '.08s' } as React.CSSProperties}>
              Every bug leaves clues.<br />
              <span className="accent">Mechamaru</span> helps you find them.
            </h1>
            <p className="lead hero-fade" style={{ '--d': '.18s' } as React.CSSProperties}>
              A backend investigation platform for engineers who want answers, not guesses. Point it at your repo, logs, and traces — get a structured diagnosis, not another chat transcript.
            </p>
            <div className="hero-actions hero-fade" style={{ '--d': '.28s' } as React.CSSProperties}>
              <button
                onClick={onStartGuest}
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="btn btn-primary magnetic"
              >
                Start Investigation →
              </button>
              <button
                onClick={onOpenByok}
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="btn btn-secondary magnetic"
              >
                Configure BYOK
              </button>
            </div>
          </div>

          {/* Hero Visual Stage */}
          <div ref={heroVisualRef} className="hero-visual hero-fade" style={{ '--d': '.2s' } as React.CSSProperties}>
            <div ref={glowRef} className="cursor-glow" />

            {/* Floating Particles */}
            <span className="particle" style={{ left: '12%', top: '70%', animationDuration: '6.5s', animationDelay: '.2s' }} />
            <span className="particle" style={{ left: '28%', top: '20%', animationDuration: '7.2s', animationDelay: '1.4s' }} />
            <span className="particle" style={{ left: '70%', top: '78%', animationDuration: '5.8s', animationDelay: '.8s' }} />
            <span className="particle" style={{ left: '85%', top: '35%', animationDuration: '6.9s', animationDelay: '2.1s' }} />
            <span className="particle" style={{ left: '50%', top: '10%', animationDuration: '7.6s', animationDelay: '.5s' }} />
            <span className="particle" style={{ left: '40%', top: '85%', animationDuration: '6.1s', animationDelay: '1.8s' }} />

            {/* Continuously Animated SVG Diagnostic Graph */}
            <svg className="graph-svg" viewBox="0 0 620 520">
              <path
                className="graph-line"
                d="M80,70 L300,260"
                style={{ stroke: '#3B80FB' }}
              />
              <path
                className="graph-line"
                d="M80,190 L300,260"
                style={{ stroke: '#34D399', animationDelay: '-.3s' }}
              />
              <path
                className="graph-line"
                d="M80,330 L300,260"
                style={{ stroke: '#F8BF74', animationDelay: '-.6s' }}
              />
              <path
                className="graph-line"
                d="M80,450 L300,260"
                style={{ stroke: '#F35171', animationDelay: '-.9s' }}
              />
              <path
                className="graph-line"
                d="M300,260 L560,260"
                style={{ stroke: '#8A74FF', strokeWidth: 1.8, animationDelay: '-1.1s' }}
              />

              <circle className="ping" cx="300" cy="260" r="34" />
              <circle className="ping p2" cx="300" cy="260" r="34" />

              {/* Node: Repository */}
              <g className="graph-node" transform="translate(80,70)">
                <circle className="core" r="19" stroke="#3B80FB" />
                <text x="0" y="38" textAnchor="middle">Repository</text>
              </g>

              {/* Node: Docs */}
              <g className="graph-node" transform="translate(80,190)">
                <circle className="core" r="19" stroke="#34D399" />
                <text x="0" y="38" textAnchor="middle">Docs</text>
              </g>

              {/* Node: Runtime */}
              <g className="graph-node" transform="translate(80,330)">
                <circle className="core" r="19" stroke="#F8BF74" />
                <text x="0" y="38" textAnchor="middle">Runtime</text>
              </g>

              {/* Node: Evidence */}
              <g className="graph-node" transform="translate(80,450)">
                <circle className="core" r="19" stroke="#F35171" />
                <text x="0" y="38" textAnchor="middle">Evidence</text>
              </g>

              {/* Center Node: Mechamaru */}
              <g className="graph-node center-node" transform="translate(300,260)">
                <circle className="core" r="34" />
                <text x="0" y="5" textAnchor="middle">Mechamaru</text>
              </g>

              {/* Node: Report */}
              <g className="graph-node" transform="translate(560,260)">
                <circle className="core" r="20" stroke="#8A74FF" />
                <text x="0" y="38" textAnchor="middle">Report</text>
              </g>
            </svg>

            {/* Floating Card: Live Timeline */}
            <div className="floating-card fc-timeline">
              <h5>Investigation</h5>
              <ul>
                {timelineSteps.map((step, idx) => (
                  <li key={step} className={idx === activeTimelineIdx ? 'active' : ''}>
                    <span className="dot" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            {/* Floating Card: Hypothesis Report */}
            <div className="floating-card fc-report">
              <div className="rt">
                <span>Hypothesis</span>
                <span className="badge">85%</span>
              </div>
              <p>Redis connection pool exhaustion in PaymentGatewayClient.</p>
            </div>

            {/* Floating Card: Diagnostic Code Fragment */}
            <div className="floating-card fc-code">
              <span style={{ opacity: codeVisible ? 1 : 0 }}>
                {codeFragments[codeIdx]}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section ref={statsSectionRef} className="stats">
        <div className="wrap">
          <div className="stats-row reveal">
            <div className="stat">
              <div className="num">
                <span>{countA}</span>
                <span className="accent">s</span>
              </div>
              <div className="lbl">Avg. time to hypothesis</div>
            </div>
            <div className="stat">
              <div className="num">
                <span>{countB}</span>
                <span className="accent">%</span>
              </div>
              <div className="lbl">Evidence-backed confidence</div>
            </div>
            <div className="stat">
              <div className="num">
                <span>{countC}</span>
                <span className="accent">+</span>
              </div>
              <div className="lbl">Investigations closed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features / Instruments Section */}
      <section className="features" id="features">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Instruments</span>
            <h2>Everything an investigation needs</h2>
            <p>No new dashboards to learn. BRAG reaches for the evidence itself, then hands you a report — not a pile of raw output.</p>
          </div>
          <div className="feature-grid">
            <div
              className="feature-card tilt reveal"
              onMouseMove={handleCardTiltMove}
              onMouseLeave={handleCardTiltLeave}
            >
              <div className="feature-icon icon-a">◆</div>
              <h3>Static &amp; dynamic RAG</h3>
              <p>Real-time log ingestion plus contextual retrieval, so answers stay grounded in what's actually happening.</p>
            </div>

            <div
              className="feature-card tilt reveal"
              style={{ transitionDelay: '.06s' }}
              onMouseMove={handleCardTiltMove}
              onMouseLeave={handleCardTiltLeave}
            >
              <div className="feature-icon icon-b">⌁</div>
              <h3>Multiple MCPs</h3>
              <p>Connect GitHub, server logs, stack traces, and documentation sources in a single investigation.</p>
            </div>

            <div
              className="feature-card tilt reveal"
              style={{ transitionDelay: '.12s', cursor: 'pointer' }}
              onClick={onOpenByok}
              onMouseMove={handleCardTiltMove}
              onMouseLeave={handleCardTiltLeave}
            >
              <div className="feature-icon icon-c">⚿</div>
              <h3>Bring your own key</h3>
              <p>Use your own provider keys for every model call. Nothing is ever stored on our side.</p>
            </div>

            <div
              className="feature-card tilt reveal"
              style={{ transitionDelay: '.18s' }}
              onMouseMove={handleCardTiltMove}
              onMouseLeave={handleCardTiltLeave}
            >
              <div className="feature-icon icon-d">▤</div>
              <h3>Structured reports</h3>
              <p>Hypothesis, evidence, assessment, and next steps — actionable insight, not just chat.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Works with your stack Marquee */}
      <section className="stack">
        <div className="section-head reveal">
          <span className="eyebrow">Works with your stack</span>
          <h2>Plugs into what you already run</h2>
        </div>
        <div className="marquee reveal">
          <div className="marquee-track">
            {/* Duplicated list for seamless infinite loop */}
            {[...marqueeChips, ...marqueeChips].map((chip, idx) => (
              <span key={`${chip.name}-${idx}`} className="chip">
                <span className="cdot" style={{ background: chip.color }} />
                {chip.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence & Architecture Pipeline */}
      <section className="architecture" id="architecture">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Intelligence</span>
            <h2>One pipeline, start to finish</h2>
            <p>Every investigation moves through the same disciplined sequence — so you always know what BRAG is doing, and why.</p>
          </div>

          <div className="pipeline reveal">
            <div className="pstep" style={{ '--dot-color': 'var(--c-planning)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Planning</h4>
              <span>Scoping the issue</span>
            </div>
            <div className="pstep" style={{ '--dot-color': 'var(--c-repository)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Repository</h4>
              <span>Reading the code</span>
            </div>
            <div className="pstep" style={{ '--dot-color': 'var(--c-documentation)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Documentation</h4>
              <span>Searching Context7</span>
            </div>
            <div className="pstep" style={{ '--dot-color': 'var(--c-runtime)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Runtime</h4>
              <span>Correlating traces</span>
            </div>
            <div className="pstep" style={{ '--dot-color': 'var(--c-evidence)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Evidence</h4>
              <span>Synthesizing findings</span>
            </div>
            <div className="pstep" style={{ '--dot-color': 'var(--c-completed)' } as React.CSSProperties}>
              <div className="pdot" />
              <h4>Report</h4>
              <span>Built &amp; delivered</span>
            </div>
          </div>

          <div className="arch-panel reveal">
            <div className="arch-copy">
              <h3>Diagnosis over conversation</h3>
              <p>Ask BRAG a normal question and it answers like a colleague — clean prose, no dashboard. Once it needs to open your repo or read a trace, it says so, then hands back a report you can act on.</p>
              <ul className="arch-list">
                <li>Confidence score attached to every hypothesis</li>
                <li>Evidence linked back to the exact file and line</li>
                <li>Next steps ranked, not just listed</li>
              </ul>
            </div>
            <div className="arch-code">
              <span className="cl-com">// diagnostic_report.ts</span><br />
              <span className="cl-key">hypothesis</span><span className="cl-punc">:</span> <span className="cl-str">"Redis connection pool exhaustion"</span><span className="cl-punc">,</span><br />
              <span className="cl-key">confidence</span><span className="cl-punc">:</span> <span className="cl-num">0.85</span><span className="cl-punc">,</span><br />
              <span className="cl-key">evidence</span><span className="cl-punc">:</span> [<br />
              &nbsp;&nbsp;<span className="cl-str">"payment_service.ts:142"</span><span className="cl-punc">,</span><br />
              &nbsp;&nbsp;<span className="cl-str">"datadog_trace_id:9a3b7c"</span><br />
              ]<span className="cl-punc">,</span><br />
              <span className="cl-key">next_steps</span><span className="cl-punc">:</span> [<br />
              &nbsp;&nbsp;<span className="cl-str">"Increase REDIS_POOL_SIZE to 200"</span><span className="cursor" /><br />
              ]
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta" id="cta">
        <div className="wrap reveal">
          <h2>Start your first investigation</h2>
          <p>Connect a repository and ask BRAG what your backend is trying to hide.</p>
          <div className="cta-actions">
            <button
              onClick={onStartGuest}
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="btn btn-primary magnetic"
            >
              Start Investigation →
            </button>
            <button
              onClick={onOpenByok}
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="btn btn-secondary magnetic"
            >
              Configure BYOK
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="footer-top reveal">
            <div className="footer-brand">
              <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <div className="brand-mark">B</div>
                <span>BRAG</span>
              </div>
              <p>Backend Retrieval &amp; Agentic Guidance. Find the bug. Keep the bragging rights.</p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <h5>Product</h5>
                <a href="#mission">Mission</a>
                <a href="#features">Instruments</a>
                <a href="#architecture">Intelligence</a>
              </div>
              <div className="footer-col">
                <h5>Workspace</h5>
                <a onClick={onStartGuest} style={{ cursor: 'pointer' }}>Live Console</a>
                <a onClick={onOpenByok} style={{ cursor: 'pointer' }}>BYOK Hub</a>
                <a onClick={onLogin} style={{ cursor: 'pointer' }}>Developer Access</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="mecha">
              <div className="mecha-avatar">◆</div>
              <span><b>Mechamaru</b> — calm, precise, persistent.</span>
            </div>
            <div className="footer-signature">BRAG — investigate with confidence. Ship with clarity.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
