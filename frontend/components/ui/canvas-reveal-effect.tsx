"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Plane } from "@react-three/drei";
import * as THREE from "three";





// Define ShaderMaterial above Shader so it is available

// Ensure Shader is a function declaration and is hoisted
function Shader({ source, uniforms, maxFps = 60 }: { source: string; uniforms: any; maxFps?: number }) {
  return (
    <Canvas className="absolute inset-0 h-full w-full">
      <ShaderMaterial source={source} uniforms={uniforms} maxFps={maxFps} />
    </Canvas>
  );
}

export const CanvasRevealEffect = ({
  animationSpeed = 10,
  opacities = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1],
  colors = [[0, 255, 255]],
  containerClassName,
  dotSize,
  showGradient = true,
  reverse = false,
}: {
  animationSpeed?: number;
  opacities?: number[];
  colors?: number[][];
  containerClassName?: string;
  dotSize?: number;
  showGradient?: boolean;
  reverse?: boolean;
}) => {
  return (
    <div className={"h-full relative w-full " + (containerClassName || "")}> {/* Removed bg-white */}
      <div className="h-full w-full">
        <DotMatrix
          colors={colors ?? [[0, 255, 255]]}
          dotSize={dotSize ?? 3}
          opacities={opacities ?? [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1]}
          shader={`\n${reverse ? 'u_reverse_active' : 'false'}_;\n animation_speed_factor_${animationSpeed.toFixed(1)}_;\n`}
          center={["x", "y"]}
        />
      </div>
      {showGradient && (
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
      )}
    </div>
  );
};

interface DotMatrixProps {
  colors?: number[][];
  opacities?: number[];
  totalSize?: number;
  dotSize?: number;
  shader?: string;
  center?: ("x" | "y")[];
}



const DotMatrix: React.FC<DotMatrixProps> = ({
  colors = [[0, 0, 0]],
  opacities = [0.04, 0.04, 0.04, 0.04, 0.04, 0.08, 0.08, 0.08, 0.08, 0.14],
  totalSize = 20,
  dotSize = 2,
  shader = "",
  center = ["x", "y"],
}) => {
  const uniforms = React.useMemo(() => {
    let colorsArray = [colors[0], colors[0], colors[0], colors[0], colors[0], colors[0]];
    if (colors.length === 2) {
      colorsArray = [colors[0], colors[0], colors[0], colors[1], colors[1], colors[1]];
    } else if (colors.length === 3) {
      colorsArray = [colors[0], colors[0], colors[1], colors[1], colors[2], colors[2]];
    }
    return {
      u_colors: {
        value: colorsArray.map((color) => [color[0] / 255, color[1] / 255, color[2] / 255]),
        type: "uniform3fv",
      },
      u_opacities: {
        value: opacities,
        type: "uniform1fv",
      },
      u_total_size: {
        value: totalSize,
        type: "uniform1f",
      },
      u_dot_size: {
        value: dotSize,
        type: "uniform1f",
      },
      u_reverse: {
        value: shader.includes("u_reverse_active") ? 1 : 0,
        type: "uniform1i",
      },
    };
  }, [colors, opacities, totalSize, dotSize, shader]);

  return (
    <Shader
      source={`\nprecision mediump float;\nin vec2 fragCoord;\nuniform float u_time;\nuniform float u_opacities[10];\nuniform vec3 u_colors[6];\nuniform float u_total_size;\nuniform float u_dot_size;\nuniform vec2 u_resolution;\nuniform int u_reverse;\nout vec4 fragColor;\nfloat PHI = 1.61803398874989484820459;\nfloat random(vec2 xy) {\n    return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);\n}\nfloat map(float value, float min1, float max1, float min2, float max2) {\n    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);\n}\nvoid main() {\n    vec2 st = fragCoord.xy;\n    ${center.includes("x") ? "st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));" : ""}\n    ${center.includes("y") ? "st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));" : ""}\n    float opacity = step(0.0, st.x);\n    opacity *= step(0.0, st.y);\n    vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));\n    float frequency = 5.0;\n    float show_offset = random(st2);\n    float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));\n    opacity *= u_opacities[int(rand * 10.0)];\n    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));\n    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));\n    vec3 color = u_colors[int(show_offset * 6.0)];\n    float animation_speed_factor = 0.5;\n    vec2 center_grid = u_resolution / 2.0 / u_total_size;\n    float dist_from_center = distance(center_grid, st2);\n    float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);\n    float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));\n    float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);\n    float current_timing_offset;\n    if (u_reverse == 1) {\n        current_timing_offset = timing_offset_outro;\n         opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);\n         opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);\n    } else {\n        current_timing_offset = timing_offset_intro;\n         opacity *= step(current_timing_offset, u_time * animation_speed_factor);\n         opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);\n    }\n    fragColor = vec4(color, opacity);\n    fragColor.rgb *= fragColor.a;\n}\n`}
      uniforms={uniforms}
      maxFps={60}
    />
  );
};

const ShaderMaterial = ({
  source,
  uniforms,
  maxFps = 60,
}: {
  source: string;
  hovered?: boolean;
  maxFps?: number;
  uniforms: any;
}) => {
  const { size } = useThree();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const timestamp = clock.getElapsedTime();
    const material: any = ref.current.material;
    if (material && material.uniforms && material.uniforms.u_time) {
      material.uniforms.u_time.value = timestamp;
    }
  });
  const getUniforms = () => {
    const preparedUniforms: any = {};
    for (const uniformName in uniforms) {
      const uniform: any = uniforms[uniformName];
      switch (uniform.type) {
        case "uniform1f":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1f" };
          break;
        case "uniform1i":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1i" };
          break;
        case "uniform3f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector3().fromArray(uniform.value),
            type: "3f",
          };
          break;
        case "uniform1fv":
          preparedUniforms[uniformName] = { value: uniform.value, type: "1fv" };
          break;
        case "uniform3fv":
          preparedUniforms[uniformName] = {
            value: uniform.value.map((v: number[]) => new THREE.Vector3().fromArray(v)),
            type: "3fv",
          };
          break;
        case "uniform2f":
          preparedUniforms[uniformName] = {
            value: new THREE.Vector2().fromArray(uniform.value),
            type: "2f",
          };
          break;
        default:
          console.error(`Invalid uniform type for '${uniformName}'.`);
          break;
      }
    }
    preparedUniforms["u_time"] = { value: 0, type: "1f" };
    preparedUniforms["u_resolution"] = {
      value: new THREE.Vector2(size.width * 2, size.height * 2),
    };
    return preparedUniforms;
  };
  const material = useMemo(() => {
    const materialObject = new THREE.ShaderMaterial({
      vertexShader: `\nprecision mediump float;\nin vec2 coordinates;\nuniform vec2 u_resolution;\nout vec2 fragCoord;\nvoid main(){\n  float x = position.x;\n  float y = position.y;\n  gl_Position = vec4(x, y, 0.0, 1.0);\n  fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;\n  fragCoord.y = u_resolution.y - fragCoord.y;\n}\n`,
      fragmentShader: source,
      uniforms: getUniforms(),
      glslVersion: THREE.GLSL3,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });
    return materialObject;
  }, [size.width, size.height, source]);
  return (
    <mesh ref={ref as any}>
      <Plane args={[2, 2]} material={material} />
    </mesh>
  );
};

