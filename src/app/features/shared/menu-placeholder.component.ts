import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-menu-placeholder',
  templateUrl: './menu-placeholder.component.html',
  styleUrls: ['./menu-placeholder.component.scss'],
})
export class MenuPlaceholderComponent {
  constructor(private readonly route: ActivatedRoute) {}

  get title(): string {
    return this.route.snapshot.data['title'] ?? 'Section';
  }

  get description(): string {
    return (
      this.route.snapshot.data['subtitle'] ??
      'Cette page est prete pour les prochains developpements.'
    );
  }
}
