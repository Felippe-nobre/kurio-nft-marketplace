import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Breadcrumb({ items, className }: { items: { label: string; to?: '/'; hash?: string }[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('text-sm font-bold', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <Fragment key={it.label}>
            <li>
              {it.to && i < items.length - 1 ? (
                <Link to={it.to} hash={it.hash} className="hover:text-brand-strong">
                  {it.label}
                </Link>
              ) : (
                <span aria-current={i === items.length - 1 ? 'page' : undefined}>{it.label}</span>
              )}
            </li>
            {i < items.length - 1 && (
              <li aria-hidden="true" className="text-text">
                /
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
