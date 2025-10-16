describe('Login flow - success', () => {
  it('logs in and lands on a parent home/search screen', () => {
    cy.visit('/');

    cy.contains(/welcome back|log in to find trusted/i, { timeout: 15000 }).should('be.visible');

    cy.intercept('POST', '**/api/auth/login').as('loginReq');

    cy.typeByIdOrPlaceholder('login-email', /you@|email/i, 'alice@example.com');
    
    cy.typeByIdOrPlaceholder('login-password', /password|•/i, 'mypassword');

    cy.clickByIdOrText('login-submit', /log in/i);

    cy.wait('@loginReq', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201]);

    cy.contains(/parent home|search|my bookings/i, { timeout: 15000 }).should('be.visible');
  });
});
