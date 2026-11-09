// router/knowledge.ts
import GraphView from '@/views/graph/GraphView.vue'
import KnowledgeChat from '@/views/knowledgeChat/KnowledgeChat.vue'
import ConceptListView from '@/views/knowledgeView/conceptListView.vue'
import DocumentListView from '@/views/knowledgeView/documentListView.vue'
import KnowledgeView from '@/views/knowledgeView/knowledgeView.vue'
import QuestionListView from '@/views/knowledgeView/questionListView.vue'
import MasteryList from '@/views/mastery/MasteryList.vue'
import ThreadListView from '@/views/thread/ThreadListView.vue'

export const KnowledgeRoutes = [
  {
    path: '/chat/:modeId/:sessionId?',
    name: 'chat',
    component: KnowledgeChat,
  },
  {
    path: '/knowledge',
    component: KnowledgeView,
    children: [
      { path: '', redirect: 'documents' },
      { path: 'concepts', redirect: 'questions' },
      {
        path: 'documents',
        name: 'KnowledgeDocuments',
        component: DocumentListView,
      },
      {
        path: 'graph',
        name: 'KnowledgeGraph',
        component: GraphView,
      },
      {
        path: 'questions',
        name: 'KnowledgeQuestions',
        component: QuestionListView,
      },
      {
        path: 'threads',
        name: 'ThreadListView',
        component: ThreadListView,
      },
      {
        path: 'mastery',
        name: 'MasteryList',
        component: MasteryList,
      },
    ],
  },
]