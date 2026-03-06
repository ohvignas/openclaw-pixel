import { prisma } from './db.js'

const WORKSPACE_ID = 'default'

export async function getOrCreateWorkspace() {
  return prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: {},
    create: {
      id: WORKSPACE_ID,
      name: 'Mon OpenClaw',
      coins: 500,
    },
  })
}
