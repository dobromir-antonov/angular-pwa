import { Platform } from '@angular/cdk/platform';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivatedRoute, Params, RouterModule } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, fromEvent, map, merge, NEVER, Observable, scan, startWith, Subject, tap } from 'rxjs';


@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  state$ = new Observable<any>();

  private state$$ = new Subject<any>();

  constructor(
    private route: ActivatedRoute,
    private platform: Platform,
    private swUpdate: SwUpdate) {
  }

  public ngOnInit(): void {
    const networkStatus$ = merge(fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
      map(_ => ({ networkStatus: window.navigator.onLine }))
    )

    const version$ = this.swUpdate.isEnabled
      ? this.swUpdate.versionUpdates.pipe(
        filter((evt: any): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        map(_ => ({ newVersion: true }))
      )
      : NEVER;

    const install$ = this.platform.ANDROID
      ? fromEvent(window, 'beforeinstallprompt').pipe(
        map(e => {
          e.preventDefault();
          return { modalPwaEvent: e, modalPwaPlatform: 'ANDROID' }
        })
      )
      : NEVER;

    const queryParams$ = this.route.queryParams.pipe(
      map(params => ({ queryParams: this.forgeQueryParams(params) }))
    )

    const isIOS = this.platform.IOS && this.platform.SAFARI;
    const isStandAlone = !!(<any>window.navigator)?.standalone;
    const modalPwaPlatform = isIOS && !isStandAlone ? 'IOS' : null;

    this.state$ = merge(networkStatus$, version$, install$, queryParams$).pipe(
      startWith({
        networkStatus: window.navigator.onLine,
        newVersion: false,
        modalPwaEvent: undefined,
        modalPwaPlatform: modalPwaPlatform,
        queryParams: []
      }),
      scan((acc, curr) => ({ ...acc, ...curr }))
    )

  }


  public updateVersion(): void {
    this.state$$.next({ newVersion: false })
    window.location.reload();
  }

  public closeVersion(): void {
    this.state$$.next({ modalVersion: false })
  }


  public addToHomeScreen(modalPwaEvent: any): void {
    modalPwaEvent.prompt();
    this.state$$.next({ modalPwaPlatform: undefined })
  }

  public closePwa(): void {
    this.state$$.next({ modalPwaPlatform: undefined })
  }

  private forgeQueryParams(params: Params) {
    return Object.entries(params)
      .reduce((acc: any[], curr) => {
        const key: string = curr[0];
        const value = curr[1];
        let p = [{ key, value }];

        if (key === 'ph_url') {
          const url = new URL(value);
          p = Array.from(url.searchParams.entries()).map(e => ({ key: e[0], value: e[1] }));
        }

        return [
          ...acc,
          ...p
        ];
      }, [])
  }
}
