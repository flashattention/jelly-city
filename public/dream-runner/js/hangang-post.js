// 한강 러닝 화면 보정: 은은한 빛 번짐(블룸) · 색감(채도 · 대비 · 시간대 색) · 가장자리 어둡게(비네트)
//   휴대폰은 쓰지 않는다 (무거워서). three/addons 의 후처리 모듈을 쓴다
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.18 }, contrast: { value: 1.06 }, tint: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.32 }, lift: { value: 0.012 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, contrast, vig, lift; uniform vec3 tint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat);
      col = (col - 0.18) * contrast + 0.18 + lift;
      vec2 d = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      gl_FragColor = vec4(max(col, 0.0), c.a); }`,
};

export function makePost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  const composer = new EffectComposer(renderer); composer.setPixelRatio(Math.min(pr, 1.5)); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.65, 0.86); composer.addPass(bloom);
  const grade = new ShaderPass(Grade); composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, grade,
    // 시간대: 노을엔 따뜻하게 · 밤엔 푸르고 빛이 더 번지게
    mood(light) {
      const n = light?.night || 0, h = light?.hour ?? 12, golden = Math.max(0, 1 - Math.abs(h - 18.4) / 1.4) + Math.max(0, 1 - Math.abs(h - 6) / 1.2);
      grade.uniforms.tint.value.setRGB(1 + golden * 0.08 - n * 0.04, 1 + golden * 0.02 - n * 0.01, 1 - golden * 0.06 + n * 0.06);
      bloom.strength = 0.28 + n * 0.55 + golden * 0.15; bloom.threshold = 0.86 - n * 0.3;
    },
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); bloom.resolution.set(w, h); },
    dispose() { composer.dispose(); },
  };
}
