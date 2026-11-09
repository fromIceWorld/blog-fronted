import { api } from './auth'

export type GraphNodeStatus = 'not-started' | 'learning' | 'proficient' | 'mastered'
export type GraphEdgeType = 'parent' | 'causes' | 'applies_to' | 'contrast' | 'example_of' | 'part_of'
export type Verdict = 'correct' | 'partial' | 'wrong' | 'missing'

export interface GraphNode {
  id: string
  name: string
  definition: string
  domain: string | null
  level: number
  parentId: string | null
  isLeaf: boolean
  isMerged: boolean
  comboId?: string

  masteryScore: number
  status: GraphNodeStatus
  totalAttempts: number
  correctAttempts: number
  lastVerdict: Verdict | null
}

export interface GraphCombo {
  id: string
  name: string
  count: number
  domain: string
}

export interface GraphEdge {
  source: string
  target: string
  type: GraphEdgeType
  label?: string
}

export interface GraphTreeNode extends GraphNode {
  children: GraphTreeNode[]
}

export interface GraphData {
  topic: {
    id: string
    name: string
    nodeCount: number
  }
  nodes: GraphNode[]
  edges: GraphEdge[]
  tree: GraphTreeNode[]
  combos: GraphCombo[]
}

export async function fetchGraph(topicId?: string): Promise<GraphData> {
  const { data } = await api.get('/knowledge/graph', { params: { topicId } })
  return data
}