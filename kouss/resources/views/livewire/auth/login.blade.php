<?php

use Illuminate\Auth\Events\Lockout;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Layout;
use Livewire\Attributes\Validate;
use Livewire\Volt\Component;

new #[Layout('components.layouts.auth')] class extends Component {
    #[Validate('required|string')]
    public string $username = '';

    #[Validate('required|string')]
    public string $password = '';
    public $classId;

    /**
     * Handle an incoming authentication request.
     */
    public function login(): void
    {
        $this->validate();

        $this->ensureIsNotRateLimited();

        if (!Auth::attempt(['username' => $this->username, 'password' => $this->password])) {
            RateLimiter::hit($this->throttleKey());

            $this->dispatch('error', path: '/lottie/error.json');
            throw ValidationException::withMessages([
                'incorrect' => __('auth.failed'),
            ]);
        }

        Session::regenerate();
        $this->reset('username', 'password');

        $user = Auth::user();
        if ($user->hasRole('admin')) {
            $this->dispatch('connected', path: '/lottie/success.json', route: 'dashboard');
            return;
        }
        $this->dispatch('error', path: '/lottie/error.json');
        throw ValidationException::withMessages([
            'incorrect' => __('auth.failed'),
        ]);
    }

    /**
     * Ensure the authentication request is not rate limited.
     */
    protected function ensureIsNotRateLimited(): void
    {
        if (!RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout(request()));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'incorrect' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the authentication rate limiting throttle key.
     */
    protected function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->username) . '|' . request()->ip());
    }
}; ?>

<form wire:submit="login"
    class="relative z-30 inline-flex flex-col items-start justify-start w-full overflow-hidden bg-white border shadow-xl max-w-[400px] lg:max-w-[350px] rounded-2xl border-border outline-neutral-200">

    @csrf
    <div
        class="relative flex flex-col items-center self-stretch justify-start w-full gap-6 p-6 overflow-hidden border-b border-neutral-200">
        <div class="w-full h-16 bg-none">
        </div>
        <div class="absolute top-0 left-0 w-full h-[100px] overflow-hidden mask-b-from-0% mask-b-to-100%">
            <img src="{{ asset('img/svg3.svg') }}" alt=""
                class="object-cover  w-full h-full opacity-30 scale-[1] ">
        </div>

        <div id="animation" class="absolute left-0 flex items-center justify-center w-full h-12 top-16 size-12 bg-none">
        </div>

        <div class="flex flex-col items-center self-stretch justify-center gap-1.5 auto">
            <h4 id="connecter" for="username"
                class="justify-start text-2xl font-bold leading-tight text-center text-black">
                Administration
            </h4>
            <p class="justify-start text-sm font-normal leading-tight text-center text-stone-500">
                Entrez vos identifiants
            </p>
        </div>
        <div class="flex flex-col items-start self-stretch justify-start w-full gap-4">
            <div class="flex flex-col w-full gap-2 h-fit">
                <x-input-field name="username" placeholder="Nom d'utilisateur" type="text" />
                <x-input-error name="username" />
            </div>
            <div class="flex flex-col w-full gap-2 h-fit">
                <x-input-field name="password" placeholder="Mot de passe" type="password" />
                <x-input-error name="password" />
            </div>
            <x-input-error name="incorrect" />
        </div>
    </div>
    <div class="self-stretch p-6 flex flex-col justify-start items-start gap-2.5 overflow-hidden">
        <x-button-icon :text="__('Valider')" :center="true" :style="__('primary-icon w-full')" :type="__('submit')" :target="'login()'" />
    </div>
</form>

<script>
    document.addEventListener('livewire:initialized', () => {
        const lottieContainer = document.getElementById("animation");

        function playLottieAnimation(path) {
            lottieContainer.innerHTML = ""; // Nettoyage
            lottie.loadAnimation({
                container: lottieContainer,
                renderer: "svg",
                loop: false,
                autoplay: true,
                path: path,
            });
        }

        Livewire.on('connected', (event) => {
            playLottieAnimation(event.path);
            setTimeout(() => {
                if (event.route == "dashboard") {
                    window.location.href = '{{ route('admin.dashboard') }}';
                    return;
                }
                window.location.href = event.route;
            }, 2000);
        });

        Livewire.on('error', (event) => {
            playLottieAnimation(event.path);
        });
    });
</script>
