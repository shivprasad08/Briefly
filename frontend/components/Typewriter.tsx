"use client"

import { motion } from "framer-motion"

export function Typewriter({ text }: { text: string }) {
  const words = text.split(" ")

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const child = {
    hidden: { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="visible"
      className="inline-block"
    >
      {words.map((word, index) => (
        <motion.span key={index} variants={child} className="mr-1">
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}
