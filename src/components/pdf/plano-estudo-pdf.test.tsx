import { describe, expect, it } from 'vitest'
import { pdf } from '@react-pdf/renderer'
import { PlanoEstudoPDF } from './plano-estudo-pdf'

describe('PlanoEstudoPDF', () => {
  it('gera um blob sem lançar erro', async () => {
    const doc = (
      <PlanoEstudoPDF
        nomeAluno="Aluno Teste"
        simuladoTitle="Simulado Diagnóstico"
        plano={{
          estrategia: 'Priorizar matemática e natureza com revisões curtas.',
          diagnostico: {
            pontosFracos: ['Função afim', 'Genética'],
            pontosFortes: ['Leitura', 'Humanas'],
            metaProximoSimulado: 'Subir TRI nas áreas prioritárias.',
          },
          atividades: [
            {
              horario: '08:00-09:00',
              titulo: 'MT - Funções',
              descricao: 'Resolver questões básicas e revisar os erros.',
              dica: 'Anote padrões de erro.',
              prioridade: 'ALTA',
              area: 'mt',
            },
            {
              horario: '10:00-10:20',
              titulo: 'Pausa estratégica',
              descricao: 'Levantar, beber água e respirar fundo.',
              dica: 'Evite telas.',
              prioridade: 'BAIXA',
              area: 'pausa',
            },
          ],
        }}
      />
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(doc as any).toBlob()
    expect(blob.size).toBeGreaterThan(0)
  })
})
