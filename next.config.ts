import type { NextConfig } from 'next';

// GitHub Pages 프로젝트 페이지(username.github.io/k-mosaic)로 배포할 때 필요한 경로 접두사.
//
// 하드코딩하지 않고 환경변수로 주입하는 이유:
//   로컬 개발(localhost:3000)은 접두사가 없어야 하고, 배포는 /k-mosaic 이어야 한다.
//   하드코딩하면 로컬에서 모든 링크가 깨진다.
//
// 이 값은 비밀이 아니라 공개 URL 의 일부이므로 NEXT_PUBLIC_ 접두사를 써도 된다.
// (보안 규칙 S2 가 금지하는 것은 NEXT_PUBLIC_*KEY|SECRET|TOKEN 이다.)
//
// 사용자 페이지(username.github.io)나 커스텀 도메인으로 바꾸면 이 값을 비운다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
