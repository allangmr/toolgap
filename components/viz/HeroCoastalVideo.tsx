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
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {reduce ? (
        <Image
          src={HERO_POSTER_SRC}
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[center_38%] md:object-[center_32%]"
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
          className="h-full w-full object-cover object-[center_38%] md:object-[center_32%]"
        >
          <source src={HERO_VIDEO_SRC} type="video/mp4" />
        </video>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/88 to-background/42" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-background/70" />
      <div className="absolute inset-y-0 left-0 w-[min(100%,42rem)] bg-[radial-gradient(120%_80%_at_0%_40%,rgb(12_14_18_/_0.72),transparent_70%)]" />
    </div>
  );
}
