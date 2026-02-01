<template>
	<div class="game-wrapper">
		<!-- Top 3 Winners -->
		<div class="top-winners">
			<div v-for="(winner, index) in topWinners" :key="index" class="winner-slot">
				<div class="winner-badge" :class="'rank-' + (index + 1)">
					<img v-if="winner" :src="winner.image" :alt="winner.name" class="winner-flag" />
					<span v-else class="empty-slot">?</span>
				</div>
				<span class="rank-label">#{{ index + 1 }}</span>
			</div>
		</div>

		<!-- Progress Bar -->
		<div class="progress-container">
			<div class="progress-label">Flags remaining: {{ activeFlags.length }}</div>
			<div class="progress-bar">
				<div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
			</div>
		</div>

		<!-- Game Arena -->
		<div class="arena-container">
			<canvas ref="gameCanvas" width="600" height="600"></canvas>

			<!-- Winner Announcement -->
			<div v-if="winner" class="winner-announcement">
				<div class="winner-content">
					<img :src="winner.image" :alt="winner.name" class="winner-big-flag" />
					<h2>{{ winner.name }} WINS!</h2>
					<button @click="restartGame" class="restart-btn">Play Again</button>
				</div>
			</div>
		</div>

		<!-- Eliminated Flags Grid -->
		<div class="eliminated-container">
			<div class="eliminated-grid">
				<div
					v-for="flag in eliminatedFlags"
					:key="flag.id"
					class="eliminated-flag"
					:title="flag.name"
				>
					<img :src="flag.image" :alt="flag.name" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Flag {
	id: number
	name: string
	image: string
	x: number
	y: number
	vx: number
	vy: number
	angle: number
	eliminated: boolean
}

const gameCanvas = ref<HTMLCanvasElement | null>(null)
const activeFlags = ref<Flag[]>([])
const eliminatedFlags = ref<Flag[]>([])
const topWinners = ref<(Flag | null)[]>([null, null, null])
const winner = ref<Flag | null>(null)

// Game settings
const centerX = 300
const centerY = 300
const arenaRadius = 220
const flagSize = 30
const gapStartAngle = -Math.PI / 4 // Gap o'ng tomonda
const gapEndAngle = Math.PI / 4
const rotationSpeed = 0.02 // Tezroq aylanish

let animationId: number
let currentRotation = 0
let gameRunning = true

// Audio context for sound effects
let audioContext: AudioContext | null = null
let lastBounceTime = 0
let lastWallHitTime = 0
const soundCooldown = 50 // ms - ovozlar orasidagi minimal vaqt

const initAudio = () => {
	if (!audioContext) {
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
	}
	return audioContext
}

// To'qnashuv ovozi (pop/bounce)
const playBounceSound = () => {
	const now = Date.now()
	if (now - lastBounceTime < soundCooldown) return
	lastBounceTime = now

	const ctx = initAudio()
	if (!ctx) return

	const oscillator = ctx.createOscillator()
	const gainNode = ctx.createGain()

	oscillator.connect(gainNode)
	gainNode.connect(ctx.destination)

	oscillator.frequency.setValueAtTime(300 + Math.random() * 200, ctx.currentTime)
	oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)

	gainNode.gain.setValueAtTime(0.15, ctx.currentTime)
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

	oscillator.start(ctx.currentTime)
	oscillator.stop(ctx.currentTime + 0.1)
}

// Eliminatsiya ovozi (whoosh)
const playEliminateSound = () => {
	const ctx = initAudio()
	if (!ctx) return

	const oscillator = ctx.createOscillator()
	const gainNode = ctx.createGain()

	oscillator.connect(gainNode)
	gainNode.connect(ctx.destination)

	oscillator.type = 'sawtooth'
	oscillator.frequency.setValueAtTime(400, ctx.currentTime)
	oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)

	gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

	oscillator.start(ctx.currentTime)
	oscillator.stop(ctx.currentTime + 0.3)
}

// G'alaba ovozi (fanfare)
const playWinSound = () => {
	const ctx = initAudio()
	if (!ctx) return

	const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6

	notes.forEach((freq, index) => {
		const oscillator = ctx.createOscillator()
		const gainNode = ctx.createGain()

		oscillator.connect(gainNode)
		gainNode.connect(ctx.destination)

		oscillator.type = 'sine'
		const startTime = ctx.currentTime + index * 0.15

		oscillator.frequency.setValueAtTime(freq, startTime)

		gainNode.gain.setValueAtTime(0, startTime)
		gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05)
		gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4)

		oscillator.start(startTime)
		oscillator.stop(startTime + 0.4)
	})
}

// G'olib nomini o'qish (Text-to-Speech)
const speakWinner = (name: string) => {
	if ('speechSynthesis' in window) {
		// Avvalgi nutqni to'xtatish
		window.speechSynthesis.cancel()

		const utterance = new SpeechSynthesisUtterance(`${name} wins!`)
		utterance.rate = 0.9 // Biroz sekinroq
		utterance.pitch = 1.3 // Balandroq ovoz (qiz bola uchun)
		utterance.volume = 1

		// Qiz bola ovozini topish
		const setFemaleVoice = () => {
			const voices = window.speechSynthesis.getVoices()
			const femaleVoice = voices.find(
				(voice) =>
					voice.name.toLowerCase().includes('female') ||
					voice.name.toLowerCase().includes('woman') ||
					voice.name.toLowerCase().includes('girl') ||
					voice.name.includes('Zira') || // Windows
					voice.name.includes('Samantha') || // macOS
					voice.name.includes('Google US English') ||
					(voice.lang.startsWith('en') && voice.name.toLowerCase().includes('f'))
			) || voices.find(voice => voice.lang.startsWith('en'))

			if (femaleVoice) {
				utterance.voice = femaleVoice
			}

			// 0.7 soniya kutib gapirish (fanfare tugaganidan keyin)
			setTimeout(() => {
				window.speechSynthesis.speak(utterance)
			}, 700)
		}

		// Voices yuklangan bo'lsa
		if (window.speechSynthesis.getVoices().length > 0) {
			setFemaleVoice()
		} else {
			// Voices yuklanishini kutish
			window.speechSynthesis.onvoiceschanged = setFemaleVoice
		}
	}
}

// Devorga urilish ovozi
const playWallHitSound = () => {
	const now = Date.now()
	if (now - lastWallHitTime < soundCooldown) return
	lastWallHitTime = now

	const ctx = initAudio()
	if (!ctx) return

	const oscillator = ctx.createOscillator()
	const gainNode = ctx.createGain()

	oscillator.connect(gainNode)
	gainNode.connect(ctx.destination)

	oscillator.type = 'sine'
	oscillator.frequency.setValueAtTime(200, ctx.currentTime)
	oscillator.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08)

	gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)

	oscillator.start(ctx.currentTime)
	oscillator.stop(ctx.currentTime + 0.08)
}

// YouTube Partner Program (YPP) mavjud davlatlar - pul to'lanadi
const countries = [
	{ id: 1, name: 'USA', image: '/flags/us.png' },
	{ id: 2, name: 'UK', image: '/flags/gb.png' },
	{ id: 3, name: 'Canada', image: '/flags/ca.png' },
	{ id: 4, name: 'Australia', image: '/flags/au.png' },
	{ id: 5, name: 'Germany', image: '/flags/de.png' },
	{ id: 6, name: 'France', image: '/flags/fr.png' },
	{ id: 7, name: 'Italy', image: '/flags/it.png' },
	{ id: 8, name: 'Spain', image: '/flags/es.png' },
	{ id: 9, name: 'Netherlands', image: '/flags/nl.png' },
	{ id: 10, name: 'Belgium', image: '/flags/be.png' },
	{ id: 11, name: 'Switzerland', image: '/flags/ch.png' },
	{ id: 12, name: 'Austria', image: '/flags/at.png' },
	{ id: 13, name: 'Sweden', image: '/flags/se.png' },
	{ id: 14, name: 'Norway', image: '/flags/no.png' },
	{ id: 15, name: 'Denmark', image: '/flags/dk.png' },
	{ id: 16, name: 'Finland', image: '/flags/fi.png' },
	{ id: 17, name: 'Ireland', image: '/flags/ie.png' },
	{ id: 18, name: 'Portugal', image: '/flags/pt.png' },
	{ id: 19, name: 'Greece', image: '/flags/gr.png' },
	{ id: 20, name: 'Poland', image: '/flags/pl.png' },
	{ id: 21, name: 'Czech Republic', image: '/flags/cz.png' },
	{ id: 22, name: 'Hungary', image: '/flags/hu.png' },
	{ id: 23, name: 'Romania', image: '/flags/ro.png' },
	{ id: 24, name: 'Lithuania', image: '/flags/lt.png' },
	{ id: 25, name: 'Japan', image: '/flags/jp.png' },
	{ id: 26, name: 'South Korea', image: '/flags/kr.png' },
	{ id: 27, name: 'India', image: '/flags/in.png' },
	{ id: 28, name: 'Indonesia', image: '/flags/id.png' },
	{ id: 29, name: 'Malaysia', image: '/flags/my.png' },
	{ id: 30, name: 'Philippines', image: '/flags/ph.png' },
	{ id: 31, name: 'Singapore', image: '/flags/sg.png' },
	{ id: 32, name: 'Thailand', image: '/flags/th.png' },
	{ id: 33, name: 'Vietnam', image: '/flags/vn.png' },
	{ id: 34, name: 'Pakistan', image: '/flags/pk.png' },
	{ id: 35, name: 'Bangladesh', image: '/flags/bd.png' },
	{ id: 36, name: 'Brazil', image: '/flags/br.png' },
	{ id: 37, name: 'Mexico', image: '/flags/mx.png' },
	{ id: 38, name: 'Argentina', image: '/flags/ar.png' },
	{ id: 39, name: 'Turkey', image: '/flags/tr.png' },
	{ id: 40, name: 'Russia', image: '/flags/ru.png' },
	{ id: 41, name: 'Ukraine', image: '/flags/ua.png' },
	{ id: 42, name: 'Kazakhstan', image: '/flags/kz.png' },
	{ id: 43, name: 'Azerbaijan', image: '/flags/az.png' },
	// { id: 44, name: 'Israel', image: '/flags/il.png' },
	{ id: 45, name: 'UAE', image: '/flags/ae.png' },
	{ id: 46, name: 'Saudi Arabia', image: '/flags/sa.png' },
	{ id: 47, name: 'Egypt', image: '/flags/eg.png' },
	{ id: 48, name: 'South Africa', image: '/flags/za.png' },
	{ id: 49, name: 'Nigeria', image: '/flags/ng.png' },
	{ id: 50, name: 'New Zealand', image: '/flags/nz.png' },
	{ id: 51, name: 'Palestine', image: '/flags/ps.png' },
]

// YouTube YPP mavjud BO'LMAGAN davlatlar (pul to'lanmaydi)
// { id: 51, name: 'Uzbekistan', image: '/flags/uz.png' },
// { id: 52, name: 'China', image: '/flags/cn.png' }, // YouTube bloklangan
// { id: 53, name: 'Iran', image: '/flags/ir.png' }, // Sanktsiyalar
// { id: 54, name: 'Iraq', image: '/flags/iq.png' },
// { id: 55, name: 'Kyrgyzstan', image: '/flags/kg.png' },
// { id: 56, name: 'Tajikistan', image: '/flags/tj.png' },
// { id: 57, name: 'Turkmenistan', image: '/flags/tm.png' },
// { id: 58, name: 'Georgia', image: '/flags/ge.png' },
// { id: 59, name: 'Armenia', image: '/flags/am.png' },
// { id: 60, name: 'Belarus', image: '/flags/by.png' }, // Sanktsiyalar
// { id: 61, name: 'Moldova', image: '/flags/md.png' },

const progressPercent = computed(() => {
	const total = countries.length
	return (activeFlags.value.length / total) * 100
})

// Rasm yuklovchi
const flagImages: Map<number, HTMLImageElement> = new Map()

const loadImages = (): Promise<void> => {
	return new Promise((resolve) => {
		let loaded = 0
		const total = countries.length

		countries.forEach((country) => {
			const img = new Image()
			img.onload = () => {
				flagImages.set(country.id, img)
				loaded++
				if (loaded === total) resolve()
			}
			img.onerror = () => {
				// Rasm yuklanmasa placeholder
				const canvas = document.createElement('canvas')
				canvas.width = 60
				canvas.height = 40
				const ctx = canvas.getContext('2d')!
				ctx.fillStyle = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
				ctx.fillRect(0, 0, 60, 40)
				ctx.fillStyle = '#fff'
				ctx.font = '10px Arial'
				ctx.fillText(country.name.slice(0, 3), 5, 25)

				const placeholderImg = new Image()
				placeholderImg.src = canvas.toDataURL()
				flagImages.set(country.id, placeholderImg)
				loaded++
				if (loaded === total) resolve()
			}
			img.src = country.image
		})
	})
}

// Bayroqlarni boshlash
const initFlags = () => {
	activeFlags.value = countries.map((country) => ({
		...country,
		x: centerX + (Math.random() - 0.5) * 200,
		y: centerY + (Math.random() - 0.5) * 200,
		vx: (Math.random() - 0.5) * 8, // Tezroq harakat
		vy: (Math.random() - 0.5) * 8,
		angle: Math.random() * Math.PI * 2,
		eliminated: false,
	}))
}

// O'yinni qayta boshlash
const restartGame = () => {
	winner.value = null
	eliminatedFlags.value = []
	topWinners.value = [null, null, null]
	currentRotation = 0
	gameRunning = true
	initFlags()
}

// Burchak normalizatsiya
const normalizeAngle = (angle: number): number => {
	while (angle < -Math.PI) angle += Math.PI * 2
	while (angle > Math.PI) angle -= Math.PI * 2
	return angle
}

// Gap ichidami tekshirish
const isInGap = (angle: number): boolean => {
	const normalized = normalizeAngle(angle - currentRotation)
	return normalized > gapStartAngle && normalized < gapEndAngle
}

// Fizika yangilash
const updatePhysics = () => {
	if (!gameRunning) return

	currentRotation += rotationSpeed

	activeFlags.value.forEach((flag) => {
		if (flag.eliminated) return

		// Harakatni yangilash
		flag.x += flag.vx
		flag.y += flag.vy

		// Biroz tasodifiy kuch qo'shish
		flag.vx += (Math.random() - 0.5) * 0.3
		flag.vy += (Math.random() - 0.5) * 0.3

		// Tezlikni cheklash
		const speed = Math.sqrt(flag.vx * flag.vx + flag.vy * flag.vy)
		const maxSpeed = 10 // Tezroq
		const minSpeed = 3  // Minimum tezlik ham yuqori
		if (speed > maxSpeed) {
			flag.vx = (flag.vx / speed) * maxSpeed
			flag.vy = (flag.vy / speed) * maxSpeed
		} else if (speed < minSpeed) {
			flag.vx = (flag.vx / speed) * minSpeed
			flag.vy = (flag.vy / speed) * minSpeed
		}

		// Markazdan masofa
		const dx = flag.x - centerX
		const dy = flag.y - centerY
		const distance = Math.sqrt(dx * dx + dy * dy)
		const angle = Math.atan2(dy, dx)

		// Aylana chegarasi bilan to'qnashuv
		if (distance > arenaRadius - flagSize / 2) {
			if (isInGap(angle)) {
				// Gap'dan chiqib ketdi - eliminatsiya!
				flag.eliminated = true
				eliminatedFlags.value.unshift({ ...flag })
				playEliminateSound() // Eliminatsiya ovozi

				// Top 3 g'oliblarni belgilash (oxirgi 3 ta chiqib ketgan)
				const remainingCount = activeFlags.value.filter(f => !f.eliminated).length
				if (remainingCount === 2) {
					// 3-o'rin - uchinchi bo'lib qolgan, ya'ni hozir chiqib ketgan
					topWinners.value[2] = { ...flag }
				} else if (remainingCount === 1) {
					// 2-o'rin
					topWinners.value[1] = { ...flag }
				}
				return
			} else {
				// Devordan qaytarish
				const overlap = distance - (arenaRadius - flagSize / 2)
				flag.x -= (dx / distance) * overlap
				flag.y -= (dy / distance) * overlap

				// Tezlikni aks ettirish
				const normalX = dx / distance
				const normalY = dy / distance
				const dotProduct = flag.vx * normalX + flag.vy * normalY
				flag.vx -= 2 * dotProduct * normalX
				flag.vy -= 2 * dotProduct * normalY

				// Biroz energiya yo'qotish
				flag.vx *= 0.8
				flag.vy *= 0.8

				playWallHitSound() // Devorga urilish ovozi
			}
		}
	})

	// Eliminatsiya qilinganlarni olib tashlash
	activeFlags.value = activeFlags.value.filter((f) => !f.eliminated)

	// Bayroqlar orasidagi to'qnashuv
	for (let i = 0; i < activeFlags.value.length; i++) {
		for (let j = i + 1; j < activeFlags.value.length; j++) {
			const a = activeFlags.value[i]
			const b = activeFlags.value[j]

			const dx = b.x - a.x
			const dy = b.y - a.y
			const distance = Math.sqrt(dx * dx + dy * dy)
			const minDist = flagSize

			if (distance < minDist && distance > 0) {
				// To'qnashuvni hal qilish
				const overlap = minDist - distance
				const nx = dx / distance
				const ny = dy / distance

				a.x -= (nx * overlap) / 2
				a.y -= (ny * overlap) / 2

				playBounceSound() // To'qnashuv ovozi
				b.x += (nx * overlap) / 2
				b.y += (ny * overlap) / 2

				// Tezliklarni almashtirish
				const dvx = a.vx - b.vx
				const dvy = a.vy - b.vy
				const dvn = dvx * nx + dvy * ny

				a.vx -= dvn * nx
				a.vy -= dvn * ny
				b.vx += dvn * nx
				b.vy += dvn * ny
			}
		}
	}

	// G'olib tekshirish - oxirgi qolgan bayroq g'olib
	if (activeFlags.value.length === 1 && !winner.value) {
		winner.value = activeFlags.value[0]
		topWinners.value[0] = winner.value
		gameRunning = false
		playWinSound() // G'alaba ovozi
		speakWinner(winner.value.name) // G'olib nomini aytish
	}
}

// Canvas chizish
const draw = () => {
	const canvas = gameCanvas.value
	if (!canvas) return

	const ctx = canvas.getContext('2d')!
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	// Aylana foni (dark)
	ctx.beginPath()
	ctx.arc(centerX, centerY, arenaRadius, 0, Math.PI * 2)
	ctx.fillStyle = '#1e293b' // Dark slate color
	ctx.fill()

	// Yashil chiziq (gap bilan)
	ctx.beginPath()
	ctx.lineWidth = 8
	ctx.strokeStyle = '#22c55e'
	ctx.lineCap = 'round'

	// Gap'dan tashqari chizish
	const startAngle = gapEndAngle + currentRotation
	const endAngle = gapStartAngle + currentRotation + Math.PI * 2

	ctx.arc(centerX, centerY, arenaRadius, startAngle, endAngle)
	ctx.stroke()

	// Bayroqlarni chizish
	activeFlags.value.forEach((flag) => {
		const img = flagImages.get(flag.id)
		if (img) {
			ctx.save()
			ctx.translate(flag.x, flag.y)

			// Bayroq rasmini chizish
			const aspectRatio = img.width / img.height
			const drawHeight = flagSize
			const drawWidth = drawHeight * aspectRatio

			ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
			ctx.restore()
		}
	})
}

// O'yin tsikli
const gameLoop = () => {
	updatePhysics()
	draw()
	animationId = requestAnimationFrame(gameLoop)
}

onMounted(async () => {
	await loadImages()
	initFlags()
	gameLoop()
})

onUnmounted(() => {
	cancelAnimationFrame(animationId)
})
</script>

<style scoped>
.game-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	color: white;
}

.top-winners {
	display: flex;
	gap: 20px;
	margin-bottom: 10px;
}

.winner-slot {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 5px;
}

.winner-badge {
	width: 60px;
	height: 60px;
	border-radius: 8px;
	background: #2a2a4a;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.winner-badge.rank-1 {
	border: 3px solid gold;
	box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}

.winner-badge.rank-2 {
	border: 3px solid silver;
}

.winner-badge.rank-3 {
	border: 3px solid #cd7f32;
}

.winner-flag {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.empty-slot {
	font-size: 24px;
	color: #555;
}

.rank-label {
	font-size: 14px;
	font-weight: bold;
	color: #888;
}

.progress-container {
	width: 400px;
	margin-bottom: 10px;
}

.progress-label {
	font-size: 12px;
	color: #888;
	margin-bottom: 5px;
}

.progress-bar {
	height: 8px;
	background: #2a2a4a;
	border-radius: 4px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #22c55e, #16a34a);
	transition: width 0.3s ease;
}

.arena-container {
	position: relative;
}

.arena-container canvas {
	border-radius: 50%;
	box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
}

.winner-announcement {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.8);
	border-radius: 50%;
	animation: fadeIn 0.5s ease;
}

.winner-content {
	text-align: center;
}

.winner-big-flag {
	width: 120px;
	height: 80px;
	object-fit: cover;
	border-radius: 8px;
	margin-bottom: 15px;
	box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.winner-content h2 {
	color: gold;
	font-size: 24px;
	margin: 0;
	text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.restart-btn {
	margin-top: 20px;
	padding: 12px 30px;
	font-size: 16px;
	font-weight: bold;
	color: white;
	background: linear-gradient(135deg, #22c55e, #16a34a);
	border: none;
	border-radius: 25px;
	cursor: pointer;
	transition: transform 0.2s, box-shadow 0.2s;
}

.restart-btn:hover {
	transform: scale(1.05);
	box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
}

.eliminated-container {
	width: 500px;
	max-height: 200px;
	overflow-y: auto;
	padding: 10px;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 10px;
}

.eliminated-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	justify-content: center;
}

.eliminated-flag {
	width: 40px;
	height: 28px;
	border-radius: 4px;
	overflow: hidden;
	border: 1px solid #333;
	transition: transform 0.2s;
}

.eliminated-flag:hover {
	transform: scale(1.2);
	z-index: 10;
}

.eliminated-flag img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
</style>
