import type { DataRepository } from '../data/repository'
import { createStudentService, type StudentService } from './student-service'
import { createCronogramaService, type CronogramaService } from './cronograma-service'

export interface Services {
  student: StudentService
  cronograma: CronogramaService
}

export function createServices(repository: DataRepository): Services {
  return {
    student: createStudentService(repository),
    cronograma: createCronogramaService(repository),
  }
}

// Re-exports
export * from './result'
export * from './errors'
export * from './student-service'
export * from './cronograma-service'
