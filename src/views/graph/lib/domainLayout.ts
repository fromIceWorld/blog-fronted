import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
} from 'd3-force'

export function computeDomainLayout(
  nodes: any[],
  edges: any[],
): Map<string, { x: number; y: number }> {
  const groups = new Map<string, typeof nodes>()
  for (const n of nodes) {
    const domain = n.data?.domain ?? '未分类'
    if (!groups.has(domain)) groups.set(domain, [])
    groups.get(domain)!.push(n)
  }

  const domainLayouts: Array<{
    domain: string
    positions: Map<string, { x: number; y: number }>
    box: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number }
  }> = []

  for (const [domain, groupNodes] of groups) {
    const ids = new Set(groupNodes.map((n) => n.id))
    const groupEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target))

    const simNodes: any[] = groupNodes.map((n) => ({
      id: n.id,
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200,
      _ref: n.data,
    }))
    const simEdges: any[] = groupEdges.map((e) => ({
      source: e.source,
      target: e.target,
      _type: e.data?.type ?? 'parent',
    }))

    const simulation = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simEdges)
          .id((d: any) => d.id)
          .distance((d: any) => (d._type === 'parent' ? 100 : 200))
          .strength((d: any) => (d._type === 'parent' ? 0.9 : 0.05)),
      )
      .force('charge', forceManyBody().strength(-250))
      .force('collide', forceCollide().radius(45))
      .stop()

    const ticks = Math.ceil(
      Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
    )
    for (let i = 0; i < ticks; i++) simulation.tick()

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of simNodes) {
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y)
      maxY = Math.max(maxY, n.y)
    }

    const rawWidth = maxX - minX
    const rawHeight = maxY - minY

    // ★ 关键：按节点数决定目标尺寸，把每个 domain 缩放到合理范围
    const nodeCount = groupNodes.length
    const targetSize =
      nodeCount <= 3 ? 200 :
      nodeCount <= 10 ? 500 :
      nodeCount <= 30 ? 800 :
      nodeCount <= 80 ? 1100 : 1400

    // 单节点情况：直接居中
    if (rawWidth < 1 || rawHeight < 1) {
      const positions = new Map<string, { x: number; y: number }>()
      positions.set(simNodes[0].id, { x: 0, y: 0 })
      domainLayouts.push({
        domain,
        positions,
        box: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
      })
      continue
    }

    const scale = Math.min(targetSize / rawWidth, targetSize / rawHeight)
    const positions = new Map<string, { x: number; y: number }>()
    let scaledMinX = Infinity, scaledMaxX = -Infinity
    let scaledMinY = Infinity, scaledMaxY = -Infinity

    for (const n of simNodes) {
      // 平移到原点，缩放，重新居中
      const x = (n.x - minX - rawWidth / 2) * scale
      const y = (n.y - minY - rawHeight / 2) * scale
      positions.set(n.id, { x, y })
      scaledMinX = Math.min(scaledMinX, x)
      scaledMaxX = Math.max(scaledMaxX, x)
      scaledMinY = Math.min(scaledMinY, y)
      scaledMaxY = Math.max(scaledMaxY, y)
    }

    domainLayouts.push({
      domain,
      positions,
      box: {
        minX: scaledMinX,
        maxX: scaledMaxX,
        minY: scaledMinY,
        maxY: scaledMaxY,
        width: scaledMaxX - scaledMinX,
        height: scaledMaxY - scaledMinY,
      },
    })

    console.log(
      `[domainLayout] ${domain}: nodes=${nodeCount}, raw=${rawWidth.toFixed(0)}x${rawHeight.toFixed(0)}, target=${targetSize}, scale=${scale.toFixed(3)}`,
    )
  }

  // 按节点数排序
  domainLayouts.sort((a, b) => b.positions.size - a.positions.size)

  // 网格平铺：PADDING 缩小到 150
  const PADDING = 150
  const COLS = Math.max(1, Math.ceil(Math.sqrt(domainLayouts.length)))
  const maxWidth = Math.max(...domainLayouts.map((d) => d.box.width), 200)
  const maxHeight = Math.max(...domainLayouts.map((d) => d.box.height), 200)
  const cellWidth = maxWidth + PADDING
  const cellHeight = maxHeight + PADDING

  console.log(
    `[domainLayout] grid: ${COLS} cols, cell=${cellWidth.toFixed(0)}x${cellHeight.toFixed(0)}, total=${(cellWidth * COLS).toFixed(0)}x${(cellHeight * Math.ceil(domainLayouts.length / COLS)).toFixed(0)}`,
  )

  const finalPositions = new Map<string, { x: number; y: number }>()

  domainLayouts.forEach((dl, i) => {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    const offsetX = col * cellWidth
    const offsetY = row * cellHeight

    for (const [id, pos] of dl.positions) {
      finalPositions.set(id, {
        x: pos.x + offsetX + cellWidth / 2,
        y: pos.y + offsetY + cellHeight / 2,
      })
    }
  })

  return finalPositions
}