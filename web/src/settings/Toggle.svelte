<script lang="ts">
  let { checked = $bindable(), label }: { checked: boolean; label: string } = $props();
</script>

<label class="row">
  <span>{label}</span>
  <input type="checkbox" role="switch" bind:checked />
</label>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0;
    cursor: pointer;
  }
  input {
    appearance: none;
    width: 2.9rem;
    height: 1.75rem;
    border-radius: 1rem;
    background: rgba(120, 120, 128, 0.36);
    position: relative;
    cursor: pointer;
    transition: background 0.2s;
    flex: none;
    margin: 0;
  }
  input::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0.1rem 0.3rem rgba(0, 0, 0, 0.3);
    transition: transform 0.2s;
  }
  input:checked {
    background: var(--green);
  }
  input:checked::after {
    transform: translateX(1.15rem);
  }
</style>
