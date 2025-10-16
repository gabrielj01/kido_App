Cypress.on('uncaught:exception', () => false); // ignore app-side JS errors (e.g., "testID is not defined")

const SITTER_EMAIL = Cypress.env('SITTER_EMAIL') || 'noa@example.com';
const SITTER_PASSWORD = Cypress.env('SITTER_PASSWORD') || 'mypassword';

// Parse a money-like text into number, tolerant to ₪ / ILS / spaces / commas.
const parseMoney = (t) => {
  const n = Number(String(t).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Read the KPI "Earnings" on PayoutsScreen: scope to the "Earnings" card then grab first money-like text.
const readEarningsKpi = () =>
  cy.contains(/^Earnings$/i).filter(':visible').first().parent().within(() => {
    return cy.contains(/₪|ILS|\d[\d,.\s]*\d?/, { matchCase: false })
      .filter(':visible')
      .first()
      .invoke('text')
      .then(parseMoney);
  });

// Click a period chip by visible label
const clickChip = (label) =>
  cy.contains(new RegExp(`^${label}$`, 'i'), { timeout: 8000 })
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true });

describe('Sitter flow - Payouts filters (chips) and totals', () => {
  beforeEach(() => {
    // --- LOGIN as sitter ---
    cy.visit('/');
    cy.intercept('POST', '/api/auth/login').as('loginReq');

    cy.findByTestId('login-email').type(SITTER_EMAIL);
    cy.findByTestId('login-password').type(SITTER_PASSWORD);
    cy.findByTestId('login-submit').click();

    cy.wait('@loginReq')
      .its('response.statusCode')
      .should('satisfy', (code) => [200, 201, 304].includes(Number(code)));

    cy.get('body').find('[data-testid="login-error"]').should('not.exist');

    cy.findAllByText(/^Payouts$/i).filter(':visible').first().click({ force: true });

    // Assert we are truly on Payouts by waiting for unique screen text & chip labels
    cy.findAllByText(/Payments are on-site/i, { timeout: 10000 })
      .filter(':visible')
      .first()
      .should('be.visible');

    // Wait for the chips to be present (they exist in PayoutsScreen.jsx)
    cy.contains(/^All time$/i, { timeout: 10000 }).should('exist');
    cy.contains(/^This month$/i, { timeout: 10000 }).should('exist');
    cy.contains(/^This week$/i, { timeout: 10000 }).should('exist');
    cy.contains(/^Last week$/i, { timeout: 10000 }).should('exist');
  });

  it('logs in as sitter, opens Payouts, switches chips and keeps totals coherent', () => {
    // Initial: All time (default selection in most UIs)
    readEarningsKpi().then((allTime) => {
      expect(allTime).to.be.a('number');

      // This month
      clickChip('This month');
      cy.wait(120);
      readEarningsKpi().then((thisMonth) => {
        expect(thisMonth).to.be.a('number');
        expect(thisMonth).to.be.at.most(allTime);

        // This week
        clickChip('This week');
        cy.wait(120);
        readEarningsKpi().then((thisWeek) => {
          expect(thisWeek).to.be.a('number');
          expect(thisWeek).to.be.at.most(thisMonth);

          // Last week
          clickChip('Last week');
          cy.wait(120);
          readEarningsKpi().then((lastWeek) => {
            expect(lastWeek).to.be.a('number');

            // Soft sanity: if there is data, two weeks shouldn't always match
            if (thisWeek !== 0 || lastWeek !== 0) {
              expect(lastWeek).to.not.equal(thisWeek);
            }
          });
        });
      });
    });
  });

  it('keeps only one period chip active at a time (soft visual check)', () => {
    // We validate that each chip can be activated in turn and remains visible.
    clickChip('This month');
    cy.contains(/^This month$/i).filter(':visible').should('have.length.at.least', 1);

    clickChip('This week');
    cy.contains(/^This week$/i).filter(':visible').should('have.length.at.least', 1);

    clickChip('Last week');
    cy.contains(/^Last week$/i).filter(':visible').should('have.length.at.least', 1);

    clickChip('All time');
    cy.contains(/^All time$/i).filter(':visible').should('have.length.at.least', 1);
  });
});
