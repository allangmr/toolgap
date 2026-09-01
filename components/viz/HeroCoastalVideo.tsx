"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

export const HERO_VIDEO_SRC = "/media/hero-coastal.mp4";
export const HERO_POSTER_SRC = "/media/hero-coastal.jpg";

export function HeroCoastalVideo() {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduce) return;
    video.muted = true;
    void video.play().catch(() => {
      /* autoplay can be blocked; poster remains visible */
    });
  }, [reduce]);

  return (
    <div
      className="relative aspect-[3/2] overflow-hidden rounded-lg border border-border shadow-[var(--shadow)]"
      aria-hidden="true"
    >
      {reduce ? (
        <Image
          src={HERO_POSTER_SRC}
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 44vw, 100vw"
          className="object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_POSTER_SRC}
          preload="metadata"
          disablePictureInPicture
          className="h-full w-full object-cover"
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
