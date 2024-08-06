const image = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzUxIiBoZWlnaHQ9Ijc1MSIgdmlld0JveD0iMCAwIDc1MSA3NTEiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik03MzkuMzM2IDQ2Ni41ODdDNjg5LjI1IDY2Ny40OCA0ODUuNzggNzg5Ljc0IDI4NC44NjQgNzM5LjY0M0M4NC4wMjk2IDY4OS41NTggLTM4LjIzMSA0ODYuMDc2IDExLjg3NzggMjg1LjE5NUM2MS45Mzk4IDg0LjI3ODggMjY1LjQxMSAtMzcuOTkzNCA0NjYuMjY4IDEyLjA5MjFDNjY3LjE3MiA2Mi4xNzc1IDc4OS40MjEgMjY1LjY4MyA3MzkuMzM2IDQ2Ni41ODdaIiBmaWxsPSJ1cmwoI3BhaW50MF9saW5lYXJfMTAxXzE2KSIvPgo8cGF0aCBkPSJNNTQwLjkzOCAzMjIuNDQ2QzU0OC40MDIgMjcyLjU0OCA1MTAuNDExIDI0NS43MjQgNDU4LjQ2MiAyMjcuODNMNDc1LjMxMyAxNjAuMjM3TDQzNC4xNjkgMTQ5Ljk4M0w0MTcuNzYzIDIxNS43OTVDNDA2Ljk0NyAyMTMuMDk5IDM5NS44MzcgMjEwLjU1NyAzODQuNzk4IDIwOC4wMzdMNDAxLjMyMiAxNDEuNzkxTDM2MC4yMDEgMTMxLjUzOEwzNDMuMzM4IDE5OS4xMDdDMzM0LjM4NSAxOTcuMDY4IDMyNS41OTYgMTk1LjA1MyAzMTcuMDY1IDE5Mi45MzJMMzE3LjExMiAxOTIuNzIxTDI2MC4zNyAxNzguNTUzTDI0OS40MjUgMjIyLjQ5OEMyNDkuNDI1IDIyMi40OTggMjc5Ljk1MiAyMjkuNDk0IDI3OS4zMDcgMjI5LjkyN0MyOTUuOTcxIDIzNC4wODcgMjk4Ljk4MyAyNDUuMTE0IDI5OC40NzkgMjUzLjg1N0wyNzkuMjg0IDMzMC44NkMyODAuNDMyIDMzMS4xNTMgMjgxLjkyMSAzMzEuNTc1IDI4My41NjEgMzMyLjIzMUMyODIuMTkgMzMxLjg5MSAyODAuNzI1IDMzMS41MTYgMjc5LjIxNCAzMzEuMTUzTDI1Mi4zMDggNDM5LjAyM0MyNTAuMjY5IDQ0NC4wODUgMjQ1LjEwMSA0NTEuNjc5IDIzMy40NTMgNDQ4Ljc5NkMyMzMuODYzIDQ0OS4zOTQgMjAzLjU0NyA0NDEuMzMxIDIwMy41NDcgNDQxLjMzMUwxODMuMTIxIDQ4OC40MjlMMjM2LjY2MyA1MDEuNzc2QzI0Ni42MjQgNTA0LjI3MiAyNTYuMzg2IDUwNi44ODUgMjY1Ljk5NSA1MDkuMzQ2TDI0OC45NjggNTc3LjcxM0wyOTAuMDY1IDU4Ny45NjdMMzA2LjkyOCA1MjAuMzI3QzMxOC4xNTUgNTIzLjM3NCAzMjkuMDUzIDUyNi4xODYgMzM5LjcxNyA1MjguODM1TDMyMi45MTMgNTk2LjE1OEwzNjQuMDU3IDYwNi40MTJMMzgxLjA4NCA1MzguMTc0QzQ1MS4yNDMgNTUxLjQ1MSA1MDQuMDAxIDU0Ni4wOTYgNTI2LjIwNyA0ODIuNjRDNTQ0LjEwMiA0MzEuNTQ2IDUyNS4zMTcgNDAyLjA3NCA0ODguNDAzIDM4Mi44NTZDNTE1LjI4NSAzNzYuNjU2IDUzNS41MzUgMzU4Ljk3MyA1NDAuOTM4IDMyMi40NDZaTTQ0Ni45MzEgNDU0LjI2OUM0MzQuMjE2IDUwNS4zNjIgMzQ4LjE4OSA0NzcuNzQxIDMyMC4yOTkgNDcwLjgxNUwzNDIuODkzIDM4MC4yNDJDMzcwLjc4MyAzODcuMjAzIDQ2MC4yMiA0MDAuOTg0IDQ0Ni45MzEgNDU0LjI2OVpNNDU5LjY1NyAzMjEuNzA4QzQ0OC4wNTYgMzY4LjE4NCAzNzYuNDU1IDM0NC41NzEgMzUzLjIyOCAzMzguNzgyTDM3My43MTMgMjU2LjYzNEMzOTYuOTM5IDI2Mi40MjMgNDcxLjczOSAyNzMuMjI4IDQ1OS42NTcgMzIxLjcwOFoiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MF9saW5lYXJfMTAxXzE2IiB4MT0iMTU4NC4yOCIgeTE9Ii0xNzUuMzU3IiB4Mj0iLTc2LjgwMTQiIHkyPSI2MDEuNDA5IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGMEM5QkQiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNUMwMEY1Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==';

export const NOMIC = {
  width: 300,
  height: 300,
  margin: 0,
  qrOptions: { typeNumber: '0', mode: 'Byte', errorCorrectionLevel: 'Q' },
  imageOptions: { hideBackgroundDots: true, imageSize: 0.2, margin: 4 },
  dotsOptions: { type: 'dots', color: '#6000e1', gradient: null },
  backgroundOptions: {
    color: 'white',
    gradient: null,
  },
  image: image,
  dotsOptionsHelper: {
    colorType: { single: true, gradient: false },
    gradient: {
      linear: true,
      radial: false,
      color1: '#6a1a4c',
      color2: '#6a1a4c',
      rotation: '0',
    },
  },
  cornersSquareOptions: { type: 'dot', color: '#6000e1', gradient: null },
  cornersSquareOptionsHelper: {
    colorType: { single: true, gradient: false },
    gradient: {
      linear: true,
      radial: false,
      color1: '#000000',
      color2: '#000000',
      rotation: '0',
    },
  },
  cornersDotOptions: { type: 'dot', color: '#6000e1', gradient: null },
  cornersDotOptionsHelper: {
    colorType: { single: true, gradient: false },
    gradient: {
      linear: true,
      radial: false,
      color1: '#000000',
      color2: '#000000',
      rotation: '0',
    },
  },
  backgroundOptionsHelper: {
    colorType: { single: true, gradient: false },
    gradient: {
      linear: true,
      radial: false,
      color1: '#ffffff',
      color2: '#ffffff',
      rotation: '0',
    },
  },
}