import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="not-found">
      <span class="code">404</span>
      <h1>Página no encontrada</h1>
      <p>La ruta que buscas no existe o aún no está disponible.</p>
      <a routerLink="/dashboard" class="back-btn">
        <i class="pi pi-arrow-left"></i>
        Volver al inicio
      </a>
    </div>
  `,
  styles: [`
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      text-align: center;
    }
    .code {
      font-size: 6rem;
      font-weight: 800;
      background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.15)), var(--brand-button);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
    }
    h1 {
      margin: 1rem 0 0.5rem;
      font-size: 1.5rem;
      color: #1a1a2e;
    }
    p {
      color: #8c8c9e;
      margin: 0 0 2rem;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.5rem;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.875rem;
      color: #fff;
      background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(0,0,0,0.15)), var(--brand-button);
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(var(--brand-button-rgb), 0.35);
      }
    }
  `]
})
export class NotFoundComponent {}
