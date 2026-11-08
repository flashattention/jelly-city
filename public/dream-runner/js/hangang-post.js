// 한강 러닝 화면 보정: 은은한 빛 번짐(블룸) · 색감(채도 · 대비 · 시간대 색) · 가장자리 어둡게(비네트)
//   휴대폰은 쓰지 않는다 (무거워서). three/addons 의 후처리 모듈을 쓴다
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 감성 보정: 그림자는 라벤더 · 밝은 곳은 금빛(스플릿 토닝) · 위아래 살짝 흐리게(틸트 시프트, 미니어처 같은 느낌) · 필름 결 · 비네트
const Grade = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1280, 720) }, time: { value: 0 }, sat: { value: 0.9 }, contrast: { value: 0.97 }, tint: { value: new THREE.Color(1, 1, 1) },
    shadowCol: { value: new THREE.Vector3(0.86, 0.84, 1.12) }, hiCol: { value: new THREE.Vector3(1.08, 1.0, 0.9) }, split: { value: 0.6 }, vig: { value: 0.42 }, blur: { value: 0.7 }, grain: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, sat, contrast, split, vig, blur, grain; uniform vec3 tint; uniform vec3 shadowCol, hiCol; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      // 틸트 시프트: 가운데 띠는 또렷, 위아래로 갈수록 흐리게
      float band = smoothstep(0.18, 0.5, abs(vUv.y - 0.52)) * blur; vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (band > 0.01) { vec3 acc = col; float r = band * 4.5; for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r / res).rgb; acc += texture2D(tDiffuse, vUv + vec2(cos(a + 0.39), sin(a + 0.39)) * r * 2.0 / res).rgb; } col = acc / 17.0; }
      col *= tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, sat);
      col = mix(col, col * shadowCol, split * (1.0 - smoothstep(0.0, 0.45, l)));
      col = mix(col, col * hiCol, split * smoothstep(0.35, 1.0, l));
      col = (col - 0.18) * contrast + 0.18 + vec3(0.018, 0.010, 0.022); // 그림자를 살짝 들어 올려 몽환적으로
      vec2 d = vUv - 0.5; col *= 1.0 - vig * smoothstep(0.2, 0.9, dot(d, d) * 2.2);
      col += (h(vUv * res + time) - 0.5) * grain;
      gl_FragColor = vec4(max(col, 0.0), 1.0); }`,
};

export function makePost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  const composer = new EffectComposer(renderer); composer.setPixelRatio(Math.min(pr, 1.5)); composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.65, 0.86); composer.addPass(bloom);
  const grade = new ShaderPass(Grade); grade.uniforms.res.value.set(size.x, size.y); composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, grade,
    // 시간대: 노을엔 따뜻하게 · 밤엔 푸르고 빛이 더 번지게
    mood(light) {
      const n = light?.night || 0, h = light?.hour ?? 12, golden = Math.max(0, 1 - Math.abs(h - 18.4) / 1.4) + Math.max(0, 1 - Math.abs(h - 6) / 1.2);
      grade.uniforms.tint.value.setRGB(1.03 + golden * 0.08 - n * 0.05, 1 + golden * 0.02 - n * 0.02, 0.97 - golden * 0.06 + n * 0.08);
      if (n > 0.5) grade.uniforms.shadowCol.value.set(0.78, 0.86, 1.22); else grade.uniforms.shadowCol.value.set(0.86, 0.82, 1.14); if (n > 0.5) grade.uniforms.hiCol.value.set(1.12, 1.0, 0.82); else if (golden > 0.3) grade.uniforms.hiCol.value.set(1.14, 0.98, 0.82); else grade.uniforms.hiCol.value.set(1.06, 1.0, 0.92);
      grade.uniforms.time.value = (grade.uniforms.time.value + 1.37) % 1000;
      bloom.strength = 0.35 + n * 0.6 + golden * 0.25; bloom.threshold = 0.82 - n * 0.3;
    },
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); bloom.resolution.set(w, h); grade.uniforms.res.value.set(w, h); },
    dispose() { composer.dispose(); },
  };
}
