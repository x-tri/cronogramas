import type { Aluno } from '../../types/domain'
import { StudentAvatar } from './student-avatar'

type StudentCardProps = {
  student: Aluno
}

export function StudentCard({ student }: StudentCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
      <StudentAvatar nome={student.nome} matricula={student.matricula} />

      {/* Info */}
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900">{student.nome}</h3>
        <div className="flex gap-4 mt-1">
          <span className="text-sm text-gray-500">
            Matrícula: <span className="font-medium">{student.matricula}</span>
          </span>
          <span className="text-sm text-gray-500">
            Turma:{' '}
            <span className="font-medium text-blue-600">{student.turma}</span>
          </span>
        </div>
      </div>

      {/* Badge */}
      <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
        Pré-Vestibular
      </div>
    </div>
  )
}
