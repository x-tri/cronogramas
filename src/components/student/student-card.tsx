import type { Aluno } from '../../types/domain'

type StudentCardProps = {
  student: Aluno
}

export function StudentCard({ student }: StudentCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Photo placeholder */}
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
        {student.nome
          .split(' ')
          .slice(0, 2)
          .map((n) => n[0])
          .join('')}
      </div>

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
