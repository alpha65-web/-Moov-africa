@props([
    'style' => 'primary-icon',
    'center' => false,
    'target' => null,
    'text' => null,
    'type' => 'button',
])

<button {{ $attributes }} class="{{ $style }} active-scale relative"
    @if ($target) wire:loading.attr="disabled"
    wire:target="{{ $target }}" @endif
    type="{{ $type }}">
    <span
        class="flex @empty($text) gap-0 @else gap-1 @endempty {{ $center ? 'items-center-safe justify-center-safe' : '' }}">
        {{ $slot }}
        <p class="w-fit whitespace-nowrap"
            @if ($target) wire:target="{{ $target }}" wire:loading.class='opacity-0 scale-0 transition duration-300' @endif>
            {{ $text }}
        </p>
    </span>
    @if ($target)
        <div class="absolute inset-0 flex justify-center items-center">
            <x-lucide-loader-circle wire:loading.class='opacity-100 scale-100 transition duration-300'
                wire:target="{{ $target }}"
                class="w-[16px] h-[16px] opacity-0 animate-spin transition scale-0 duration-300 origin-center" />
        </div>
    @endif
</button>
