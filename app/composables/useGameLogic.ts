import Matter from 'matter-js'

export const useGameLogic = (engine: Matter.Engine) => {
	const eliminatedFlags = ref<any[]>([])
	const isGameRunning = ref(false)
	const neonColor = '#00f2ff'

	const createCircularArena = (
		centerX: number,
		centerY: number,
		radius: number
	) => {
		const wall = Matter.Bodies.circle(centerX, centerY, radius, {
			isStatic: true,
			render: {
				fillStyle: 'transparent',
				strokeStyle: neonColor,
				lineWidth: 2,
			},
		})

		// Arena devorlariga "wall" labelini berish
		wall.label = 'wall'

		Matter.World.add(engine.world, wall)
		return wall
	}

	const spawnFlag = (country: any, x: number, y: number) => {
		const flag = Matter.Bodies.circle(x, y, 12, {
			label: 'flag',
			restitution: 0.9, // Ko'proq sakrash uchun
			friction: 0.01, // Kamroq ishqalanish
			frictionAir: 0, // Havo qarshiligini olib tashlash
			render: {
				sprite: { texture: country.image, xScale: 0.08, yScale: 0.08 },
			},
		})
		// Custom data saqlash
		;(flag as any).countryData = country
		Matter.World.add(engine.world, flag)

		// Boshlang'ich sekinroq harakat
		Matter.Body.setVelocity(flag, {
			x: (Math.random() - 0.5) * 4,
			y: (Math.random() - 0.5) * 4,
		})
	}

	// To'qnashuvlar endi Matter.js tomonidan tabiiy ravishda boshqariladi.
	// Qo'lda kuch qo'llash mantiqi olib tashlandi.

	return { eliminatedFlags, isGameRunning, createCircularArena, spawnFlag }
}
