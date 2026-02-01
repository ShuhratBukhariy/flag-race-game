import Matter from 'matter-js'

export const usePhysics = () => {
	const engine = Matter.Engine.create()
	const runner = Matter.Runner.create()

	// Gravitatsiyani sozlash (ixtiyoriy)
	engine.gravity.y = 0

	const initPhysics = (element: HTMLElement) => {
		const render = Matter.Render.create({
			element,
			engine,
			options: {
				width: 800,
				height: 800,
				wireframes: false,
				background: 'transparent',
				pixelRatio: window.devicePixelRatio,
			},
		})

		// Neon effekti (Glow)
		Matter.Events.on(render, 'beforeRender', () => {
			const ctx = render.context
			ctx.shadowBlur = 15
			ctx.shadowColor = '#00f2ff'
		})

		Matter.Render.run(render)
		Matter.Runner.run(runner, engine)

		return { render, engine }
	}

	return { engine, initPhysics }
}
