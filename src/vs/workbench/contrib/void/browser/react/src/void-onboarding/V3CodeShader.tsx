/*--------------------------------------------------------------------------------------
 *  V3Code — Ambient shader background
 *  GPU-accelerated atmosphere: deep void + amethyst swirl + flow field
 *--------------------------------------------------------------------------------------*/

import {
  Shader,
  FlowField,
  SolidColor,
  Swirl,
} from 'shaders/react'

export default function V3CodeShader() {
  return (
    <Shader className="absolute inset-0 -z-10">
      {/* Near-black void. Almost no color — the accents pop because
          everything else is committed to the dark. */}
      <SolidColor color="#020207" />
      <Swirl
        blend={5}
        colorA="#3B1568"
        colorB="#020207"
        colorSpace="oklab"
        detail={3.0}
        speed={0.022}
      />
      <FlowField
        detail={1.4}
        evolutionSpeed={0.9}
        speed={0.35}
        strength={0.10}
      />
    </Shader>
  )
}
