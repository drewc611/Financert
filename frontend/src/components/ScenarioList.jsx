import { useAppData } from '../context/AppDataContext'
import { useI18n } from '../i18n'

/* The scenarios this browser has kept (BACKLOG F39).
 *
 * Local, like the portfolio: a scenario is a thought, and the app holds one
 * whether or not a backend is running. Nothing here is sent anywhere.
 */
export default function ScenarioList() {
  const { scenarios, openScenario, deleteScenario, scenario } = useAppData()
  const { t, fmt } = useI18n()

  if (!scenarios.length) return null

  return (
    <>
      <div className="card-head" style={{ marginTop: 28 }}>
        <h2>{t('scenario.listTitle')}</h2>
      </div>
      <p className="sub">{t('scenario.listSub')}</p>
      <div className="chart-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('scenario.name')}</th>
              <th scope="col" className="num">
                {t('portfolio.title')}
              </th>
              <th scope="col" className="num">
                {t('scenario.classes')}
              </th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {scenarios.map((saved) => {
              const total = Object.values(saved.holdings).reduce((a, b) => a + b, 0)
              const open = scenario?.name === saved.name
              return (
                <tr key={saved.name}>
                  <td>{saved.name}</td>
                  <td className="num">{fmt.usd(total, { compact: true })}</td>
                  <td className="num">{Object.keys(saved.holdings).length}</td>
                  <td className="num">
                    {open ? (
                      <span className="th-note">{t('scenario.openNow')}</span>
                    ) : (
                      <button type="button" className="link-btn" onClick={() => openScenario(saved.name)}>
                        {t('scenario.open')}
                      </button>
                    )}{' '}
                    <button type="button" className="link-btn" onClick={() => deleteScenario(saved.name)}>
                      {t('scenario.delete')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
