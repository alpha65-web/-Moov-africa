@props([
    'type' => 'text',
    'placeholder' => null,
    'name' => null,
    'value' => null,
    'live' => false,
    'required' => true,
    'disabled' => false,
])

@if ($type == 'password')
    <div class="flex items-center px-0 overflow-hidden input password-toggle">
        <input
            @if ($live) wire:model.live="{{ $name }}"
            @else wire:model="{{ $name }}" @endif
            {{ $attributes }} type="{{ $type }}" class="w-full h-full px-2 border-none outline-none password"
            placeholder="{{ $placeholder }}" id="{{ $name }}" {{ $required == true ? 'required' : '' }}
            {{ $disabled ? 'disabled' : '' }} />
        <button type="button"
            class="h-10 w-10 p-0 toggle-button transition duration-300 group flex justify-center border-black/10 items-center *:text-neutral-500 cursor-pointer active:bg-black/10 border-l-2 border-dotted">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="lucide lucide-eye-icon lucide-eye group-active:scale-[0.9] transition-all duration-200">
                <path
                    d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                <circle cx="12" cy="12" r="3" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="lucide lucide-eye-off-icon lucide-eye-off hidden group-active:scale-[0.9] transition-all duration-200">
                <path
                    d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                <path
                    d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                <path d="m2 2 20 20" />
            </svg>
        </button>
    </div>
@else
    <input wire:model="{{ $name }}" type="{{ $type }}" class="input" placeholder="{{ $placeholder }}"
        id="{{ $name }}" {{ $required ? 'required' : '' }} {{ $disabled ? 'disabled' : '' }} />
@endif
