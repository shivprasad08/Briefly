import type { ReactThreeFiber } from '@react-three/fiber';
import type { ShaderMaterial, Vector2 } from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements extends ReactThreeFiber.IntrinsicElements {
      cPPNShaderMaterial: ReactThreeFiber.Object3DNode<
        ShaderMaterial & { iTime: number; iResolution: Vector2 },
        ShaderMaterial
      >;
    }
  }
}

export {};

// Temporary module declaration until @radix-ui/react-tooltip is installed locally
declare module '@radix-ui/react-tooltip';
