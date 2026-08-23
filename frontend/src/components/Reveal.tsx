"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealDirection = "up" | "down" | "left" | "right" | "scale" | "fade";

interface RevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
  threshold?: number;
}

const TRANSFORM_MAP: Record<RevealDirection, (distance: number) => string> = {
  up: (d) => `translateY(${d}px)`,
  down: (d) => `translateY(-${d}px)`,
  left: (d) => `translateX(${d}px)`,
  right: (d) => `translateX(-${d}px)`,
  scale: () => `scale(0.95)`,
  fade: () => `none`,
};

export default function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 600,
  distance = 24,
  className = "",
  once = true,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  const initialTransform = TRANSFORM_MAP[direction](distance);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : initialTransform,
        transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  stagger?: number;
  direction?: RevealDirection;
  duration?: number;
  distance?: number;
  className?: string;
  threshold?: number;
}

export function RevealGroup({
  children,
  stagger = 80,
  direction = "up",
  duration = 600,
  distance = 24,
  className = "",
  threshold = 0.1,
}: RevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const initialTransform = TRANSFORM_MAP[direction](distance);

  return (
    <div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div
              key={i}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "none" : initialTransform,
                transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${i * stagger}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${i * stagger}ms`,
                willChange: visible ? "auto" : "opacity, transform",
              }}
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}
