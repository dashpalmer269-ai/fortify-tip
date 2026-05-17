"use client";
import dynamic from "next/dynamic";

const AnimatedSphere = dynamic(() => import("./AnimatedSphere"), { ssr: false });

export default function AnimatedSphereWrapper() {
  return <AnimatedSphere />;
}
