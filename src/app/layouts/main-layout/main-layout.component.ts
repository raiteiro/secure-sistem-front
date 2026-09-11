import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavigationService } from '../../core/services/navigation.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { CompaniesService } from '../../features/companies/services/companies.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ToastModule],
  template: `
    <p-toast key="global" position="top-right" styleClass="custom-toast" />
    <div class="app-layout">
      <app-sidebar />
      <main class="app-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-layout { display: flex; min-height: 100vh; }
    .app-content {
      flex: 1; margin-left: 260px; padding: 1.5rem 2rem;
      background: #f4f6fa; transition: margin-left 0.25s ease; min-height: 100vh;
    }
  `]
})
export class MainLayoutComponent implements OnInit {
  private readonly navService = inject(NavigationService);
  private readonly authService = inject(AuthService);
  private readonly companiesService = inject(CompaniesService);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    this.navService.loadUserTree().subscribe();

    const companyId = this.authService.currentUser()?.companyId;
    if (companyId) {
      this.companiesService.getById(companyId).subscribe({
        next: (company) => this.themeService.applyPreset(company.colorPreset),
        error: () => this.themeService.reset()
      });
    }
  }
}
