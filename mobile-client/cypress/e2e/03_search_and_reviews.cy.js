describe('Parent flow - Search sitter and open reviews', () => {
  const ok = (code) => expect([200, 201, 304]).to.include(Number(code));

  it('logs in, searches a babysitter, opens details then reviews', () => {
    const sitterName = Cypress.env('SITTER_NAME') || 'Noa Levi';

    // --- LOGIN ---
    cy.visit('/');
    cy.intercept('POST', '/api/auth/login').as('loginReq');

    cy.findByTestId('login-email').type('alice@example.com');
    cy.findByTestId('login-password').type('mypassword');
    cy.findByTestId('login-submit').click();

    cy.wait('@loginReq').its('response.statusCode').should(code => ok(code));

    // Pas d'erreur de login
    cy.get('body').find('[data-testid="login-error"]').should('not.exist');

    // --- NAVIGATE TO SEARCH ---
    // 1) bouton "Search" (CTA de ParentHome)
    cy.contains(/^Search$/i).filter(':visible').first().click({ force: true });

    // 2) fallback FAB "Find a babysitter" si la route n’a pas changé
    cy.location('pathname', { timeout: 1500 }).then(pathname => {
      if (pathname === '/' || pathname === '/home' || pathname === '/index.html') {
        cy.contains(/Find a babysitter/i)
          .should('exist')
          .then($el => cy.wrap($el).parent().click({ force: true }));
      }
    });

    // --- SEARCH ---
    cy.intercept({ method: 'GET', url: /\/api\/babysitters(\?|$)/ }).as('searchSitters');

    // L’input peut ne pas être "visible" (style RN Web). On force la saisie.
    cy.findByPlaceholderText('Search by name or city', { timeout: 8000 })
      .should('exist')
      .as('searchInput');

    cy.get('@searchInput').clear({ force: true }).type(sitterName, { force: true }).type('{enter}', { force: true });

    cy.wait('@searchSitters').its('response.statusCode').should(code => ok(code));
    cy.wait(150); // laisser peindre la FlatList

    // --- OPEN SITTER DETAILS ---
    cy.contains(new RegExp(`^${sitterName}$`, 'i'), { timeout: 8000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    // --- OPEN REVIEWS ---
    cy.intercept('GET', /\/api\/babysitters\/[^/]+\/reviews(\?|$)/).as('reviewsReq');

    cy.get('body').then($body => {
      const hasBtn = $body.find('[data-testid="see-reviews-button"]').length > 0;
      if (hasBtn) {
        cy.findByTestId('see-reviews-button').filter(':visible').first().click({ force: true });
      } else {
        cy.contains(/see reviews/i).filter(':visible').first().click({ force: true }).then(
          () => {},
          () => cy.contains(/^reviews$/i).filter(':visible').first().click({ force: true })
        );
      }
    });

    // <-- ICI: accepter 200 ou 304
    cy.wait('@reviewsReq').its('response.statusCode').should(code => ok(code));

    // --- ASSERTS VISIBLES UNIQUEMENT ---
    cy.findAllByText(/reviews/i, { exact: false })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .should('be.visible');

    cy.get('body').then($body => {
      const hasItem = $body.find('[data-testid="review-item"]:visible').length > 0;
      const hasList = $body.find('[data-testid="reviews-list"]:visible').length > 0;
      const hasEmpty = $body.find('[data-testid="reviews-empty-state"]:visible').length > 0;

      if (hasItem) {
        cy.findAllByTestId('review-item').filter(':visible').its('length').should('be.greaterThan', 0);
      } else if (hasList) {
        cy.findByTestId('reviews-list').filter(':visible').should('exist');
      } else if (hasEmpty) {
        cy.findByTestId('reviews-empty-state').filter(':visible').should('exist');
      } else {
        cy.contains('*:visible', /★|rating|review/i).should('exist');
      }
    });
  });
});
