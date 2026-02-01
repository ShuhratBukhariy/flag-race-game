<template>
	<div
		class="relative flex flex-col items-center gap-6 p-8 bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl"
	>
		<div
			ref="canvasContainer"
			class="rounded-full overflow-hidden border-4 border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.1)]"
		></div>

		<div class="absolute top-8 right-[-250px] w-60">
			<UCard :ui="{ body: { padding: 'p-4' } }">
				<template #header>
					<div class="flex items-center gap-2 font-bold text-cyan-400">
						<UIcon name="i-heroicons-list-bullet" />
						Eliminated
					</div>
				</template>
				<ul class="space-y-2 max-h-[500px] overflow-y-auto">
					<li
						v-for="flag in eliminatedFlags"
						:key="flag.id"
						class="flex items-center gap-3 animate-slide-in"
					>
						<UAvatar :src="flag.image" size="xs" />
						<span class="text-sm text-slate-300">{{ flag.name }}</span>
					</li>
				</ul>
			</UCard>
		</div>
	</div>
</template>

<script setup lang="ts">
const canvasContainer = ref<HTMLElement | null>(null)
const { engine, initPhysics } = usePhysics()
const { eliminatedFlags, createCircularArena, spawnFlag } =
	useGameLogic(engine)

onMounted(() => {
	if (canvasContainer.value) {
		initPhysics(canvasContainer.value)
		createCircularArena(400, 400, 300)

		// Test uchun bayroqlar
		const testCountries = [
			{ id: 1, name: 'Uzbekistan', image: '/flags/uz.png' },
			{ id: 2, name: 'USA', image: '/flags/us.png' },
		]
		testCountries.forEach(c => spawnFlag(c, 400, 400))
	}
})
</script>
