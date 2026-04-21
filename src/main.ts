import './style.css'
import { startDebugWorld } from './render/startDebugWorld.ts'

const app = document.querySelector<HTMLDivElement>('#app')

if (app === null) {
  throw new Error('Expected #app to exist')
}

const appRoot = app

let dispose = () => {}

async function bootstrap(): Promise<void> {
  dispose()
  dispose = await startDebugWorld(appRoot)
}

void bootstrap()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    dispose()
  })
}
