describe('Booking flow', () => {
  beforeEach(() => {
    cy.uiLoginAs('parent'); // uses our login helper with network stubs
  });

  it('selects a day, clicks "Choose time & book", confirms, and sees it in MyBookings', () => {
    // --- Open Search and list sitters
    cy.intercept('GET', '**/api/babysitters*', { fixture: 'babysitters.json' }).as('babysitters');

    cy.findAllByText(/search/i, { exact: false }).filter(':visible').first().click();
    cy.wait('@babysitters');

    // --- Open sitter details
    cy.findAllByText(/^maya cohen$/i)
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    // --- Pick a visible day on the calendar (first day number 1..31)
    const DAY_REGEX = /^(?:[1-9]|[12]\d|3[01])$/;
    cy.findAllByText(DAY_REGEX).filter(':visible').first().click({ force: true });

    // --- Prepare booking POST intercept (plural & singular forms)
    cy.intercept('POST', '**/api/bookings*', { fixture: 'booking.json' }).as('createBookings');
    cy.intercept('POST', '**/api/booking*',  { fixture: 'booking.json' }).as('createBooking');

    // --- Click the CTA "Choose time & book"
    cy.findAllByText(/choose time\s*&\s*book/i)
      .filter(':visible')
      .first()
      .click({ force: true });

    // --- If a time-selection modal appears, pick a time; otherwise go straight to confirm
    const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/; // 9:00, 18:30, etc.

    cy.get('body').then($b => {
      // 1) Prefer data-testid if present
      if ($b.find('[data-testid^="time-slot"]').length) {
        cy.get('[data-testid^="time-slot"]').filter(':visible').first().click({ force: true });
      } else if (TIME_REGEX.test($b.text())) {
        // 2) Any plain text time like "18:30"
        cy.findAllByText(TIME_REGEX).filter(':visible').first().click({ force: true });
      }
    });

    // --- Confirm booking (works whether modal is present or direct confirm)
    cy.findAllByText(/confirm booking|confirm/i)
      .filter(':visible')
      .first()
      .click({ force: true });

    // --- Wait whichever endpoint the app uses
    cy.wait(['@createBookings', '@createBooking'], { timeout: 15000 });

    // --- Go to "Bookings" tab and assert presence
    cy.findAllByText(/bookings|my bookings/i).filter(':visible').first().click();

    cy.findAllByText(/maya cohen/i).filter(':visible').should('exist');
    cy.findAllByText(/confirmed|accepted|pending/i).filter(':visible').should('exist');
  });
});
