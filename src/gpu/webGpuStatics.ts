type GpuBufferUsageStatics = {
  COPY_DST: number
  COPY_SRC: number
  INDIRECT: number
  INDEX: number
  MAP_READ: number
  STORAGE: number
  UNIFORM: number
  VERTEX: number
}

type GpuMapModeStatics = {
  READ: number
}

type GlobalWithWebGpuStatics = typeof globalThis & {
  GPUBufferUsage?: GpuBufferUsageStatics
  GPUMapMode?: GpuMapModeStatics
}

export function getGpuBufferUsage(): GpuBufferUsageStatics {
  const gpuBufferUsage = (globalThis as GlobalWithWebGpuStatics).GPUBufferUsage

  if (gpuBufferUsage === undefined) {
    throw new Error('Kiseki requires WebGPU buffer usage statics at runtime')
  }

  return gpuBufferUsage
}

export function getGpuMapMode(): GpuMapModeStatics {
  const gpuMapMode = (globalThis as GlobalWithWebGpuStatics).GPUMapMode

  if (gpuMapMode === undefined) {
    throw new Error('Kiseki requires WebGPU map mode statics at runtime')
  }

  return gpuMapMode
}
